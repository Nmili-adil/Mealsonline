import type { Metadata } from "next";
import { requireStorefrontAdminPage } from "@/lib/caisse212/storefront/guard";
import { getAdminIntegrationStatus, storefrontAdmin } from "@/lib/caisse212/storefront/admin";
import { storefrontErrorMessage } from "@/lib/caisse212/storefront/errors";
import type { StorefrontAdminRecord } from "@/lib/caisse212/storefront/types";
import type { StorefrontAdminIntegrationStatus } from "@/lib/caisse212/storefront/mode";
import { WebsitesTable } from "@/components/admin/storefronts/WebsitesTable";

export const metadata: Metadata = { title: "Sites web" };
export const dynamic = "force-dynamic";

export default async function AdminWebsitesPage() {
  await requireStorefrontAdminPage();
  const status: StorefrontAdminIntegrationStatus = getAdminIntegrationStatus();

  let storefronts: StorefrontAdminRecord[] = [];
  let error: string | null = null;
  if (status.mode !== "off") {
    try {
      storefronts = await storefrontAdmin.list();
    } catch (listError) {
      error = storefrontErrorMessage(listError);
    }
  }

  return (
    <div>
      <WebsitesTable
        initialStorefronts={storefronts}
        initialError={error}
        status={status}
      />
    </div>
  );
}
