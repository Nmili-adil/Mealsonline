import type { Metadata } from "next";
import { requireStorefrontAdminPage } from "@/lib/caisse212/storefront/guard";
import { getAdminIntegrationStatus } from "@/lib/caisse212/storefront/admin";
import { loadPickerCatalog } from "@/lib/caisse212/storefront/catalog-source";
import { StorefrontEditor } from "@/components/admin/storefronts/StorefrontEditor";

export const metadata: Metadata = { title: "Nouveau site" };
export const dynamic = "force-dynamic";

export default async function NewStorefrontPage() {
  await requireStorefrontAdminPage();
  const status = getAdminIntegrationStatus();

  if (status.mode === "off" || (status.mode === "live" && !status.configured)) {
    return (
      <div className="admin-card" style={{ borderColor: "#8a6d00" }}>
        <h2 style={{ marginTop: 0 }}>Création indisponible</h2>
        <p style={{ color: "#a3aca6", fontSize: 14 }}>
          {status.mode === "off"
            ? "Le module Sites web est désactivé (CAISSE212_STOREFRONT_MODE=off)."
            : `L'intégration admin Caisse212 n'est pas configurée : ${status.missingVariables.join(", ")}`}
        </p>
      </div>
    );
  }

  const catalog = await loadPickerCatalog();

  return (
    <StorefrontEditor mode="create" catalog={catalog} status={status} />
  );
}
