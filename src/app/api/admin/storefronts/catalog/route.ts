import { NextResponse } from "next/server";
import { requireStorefrontAdminApi } from "@/lib/caisse212/storefront/guard";
import { getAdminIntegrationStatus } from "@/lib/caisse212/storefront/admin";
import { loadPickerCatalog } from "@/lib/caisse212/storefront/catalog-source";
import { storefrontErrorResponse } from "@/lib/caisse212/storefront/http";

export const dynamic = "force-dynamic";

/**
 * Catalog provider for the admin pickers. The V206 document does not define
 * category/product listing endpoints, so the pickers use the website's
 * existing Caisse212 catalog mirror (synced by the worker) and the numeric
 * ids of the storefront fixtures. This endpoint is internal to our admin UI;
 * it is not presented as a Caisse212 API.
 */
export async function GET() {
  const auth = await requireStorefrontAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const [catalog, status] = await Promise.all([
      loadPickerCatalog(),
      Promise.resolve(getAdminIntegrationStatus()),
    ]);
    return NextResponse.json({ ok: true, ...catalog, status });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
