import { NextRequest, NextResponse } from "next/server";
import { requireStorefrontAdminMutation } from "@/lib/caisse212/storefront/guard";
import { storefrontAdmin } from "@/lib/caisse212/storefront/admin";
import {
  parseNumericId,
  storefrontErrorResponse,
} from "@/lib/caisse212/storefront/http";

export const dynamic = "force-dynamic";

/** Unsaved-data preview: validates + renders the draft, nothing is persisted. */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireStorefrontAdminMutation(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const numericId = parseNumericId(id);
  if (numericId === null) {
    return NextResponse.json({ ok: false, error: "Identifiant invalide" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 });
  }

  const data = (body as { data?: unknown } | null)?.data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json(
      { ok: false, error: "Le champ data doit être un objet JSON" },
      { status: 400 },
    );
  }

  try {
    const menu = await storefrontAdmin.previewMenu(
      numericId,
      data as Record<string, unknown>,
    );
    return NextResponse.json({ ok: true, menu });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
