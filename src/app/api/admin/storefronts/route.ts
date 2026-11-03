import { NextRequest, NextResponse } from "next/server";
import {
  requireStorefrontAdminApi,
  requireStorefrontAdminMutation,
} from "@/lib/caisse212/storefront/guard";
import { storefrontAdmin } from "@/lib/caisse212/storefront/admin";
import { storefrontErrorResponse } from "@/lib/caisse212/storefront/http";
import { storefrontAdminPayloadSchema } from "@/lib/caisse212/storefront/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStorefrontAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const storefronts = await storefrontAdmin.list();
    return NextResponse.json({ ok: true, storefronts });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStorefrontAdminMutation(request);
  if (!auth.ok) return auth.response;

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
    const storefront = await storefrontAdmin.create(parsed.data);
    return NextResponse.json({ ok: true, storefront }, { status: 201 });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
