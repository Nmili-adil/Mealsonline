import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, requireAdminMutation } from "@/lib/auth/guard";
import { getSiteSettings, saveSiteSettings } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await getSiteSettings());
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminMutation(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const sections = ["announcement", "hero", "restaurant", "seo", "featured"] as const;
  const patch = body as Record<string, unknown>;
  const applied: string[] = [];

  for (const section of sections) {
    if (patch[section] !== undefined) {
      await saveSiteSettings(section, patch[section]);
      applied.push(section);
    }
  }

  if (applied.length === 0) {
    return NextResponse.json({ error: "Aucune section fournie" }, { status: 400 });
  }

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: auth.session!.admin.id,
      action: "settings.update",
      entityType: "Setting",
      metadata: JSON.stringify({ sections: applied }),
    },
  });

  return NextResponse.json({ ok: true, sections: applied });
}
