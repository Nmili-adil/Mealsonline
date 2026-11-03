import { NextRequest, NextResponse } from "next/server";
import {
  requireStorefrontAdminApi,
  requireStorefrontAdminMutation,
} from "@/lib/caisse212/storefront/guard";
import { storefrontAdmin } from "@/lib/caisse212/storefront/admin";
import {
  parseNumericId,
  storefrontErrorResponse,
} from "@/lib/caisse212/storefront/http";
import { storefrontAdminPayloadSchema } from "@/lib/caisse212/storefront/schemas";

export const dynamic = "force-dynamic";

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
    const storefront = await storefrontAdmin.get(numericId);
    return NextResponse.json({ ok: true, storefront });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}

export async function PUT(
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

  const parsed = storefrontAdminPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }

  try {
    const storefront = await storefrontAdmin.update(numericId, parsed.data);
    return NextResponse.json({ ok: true, storefront });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}

export async function DELETE(
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

  try {
    await storefrontAdmin.delete(numericId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
