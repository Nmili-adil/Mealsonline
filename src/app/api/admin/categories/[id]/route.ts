import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminMutation } from "@/lib/auth/guard";
import { categoryPatchSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminMutation(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = categoryPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });
  }

  const data = parsed.data;
  const category = await prisma.category.update({
    where: { id },
    data: {
      visibleOnWebsite: data.visibleOnWebsite ?? existing.visibleOnWebsite,
      sortOrder: data.sortOrder ?? existing.sortOrder,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: auth.session!.admin.id,
      action: "category.update",
      entityType: "Category",
      entityId: category.id,
      metadata: JSON.stringify(parsed.data),
    },
  });

  return NextResponse.json({ ok: true });
}
