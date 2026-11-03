import { NextRequest, NextResponse } from "next/server";
import { requireStorefrontAdminApi } from "@/lib/caisse212/storefront/guard";
import { storefrontAdmin } from "@/lib/caisse212/storefront/admin";
import {
  parseNumericId,
  storefrontErrorResponse,
} from "@/lib/caisse212/storefront/http";

export const dynamic = "force-dynamic";

/** Saved-configuration preview: authenticated, uncached, works when inactive. */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireStorefrontAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const numericId = parseNumericId(id);
  if (numericId === null) {
    return NextResponse.json({ ok: false, error: "Identifiant invalide" }, { status: 400 });
  }

  try {
    const menu = await storefrontAdmin.getMenu(numericId);
    return NextResponse.json({ ok: true, menu });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
