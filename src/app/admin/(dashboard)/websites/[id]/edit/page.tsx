import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStorefrontAdminPage } from "@/lib/caisse212/storefront/guard";
import {
  getAdminIntegrationStatus,
  storefrontAdmin,
} from "@/lib/caisse212/storefront/admin";
import { loadPickerCatalog } from "@/lib/caisse212/storefront/catalog-source";
import { storefrontErrorMessage } from "@/lib/caisse212/storefront/errors";
import { StorefrontEditor } from "@/components/admin/storefronts/StorefrontEditor";

export const metadata: Metadata = { title: "Modifier un site" };
export const dynamic = "force-dynamic";

export default async function EditStorefrontPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStorefrontAdminPage();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const status = getAdminIntegrationStatus();
  if (status.mode === "off" || (status.mode === "live" && !status.configured)) {
    return (
      <div className="admin-card" style={{ borderColor: "#8a6d00" }}>
        <h2 style={{ marginTop: 0 }}>Édition indisponible</h2>
        <p style={{ color: "#a3aca6", fontSize: 14 }}>
          {status.mode === "off"
            ? "Le module Sites web est désactivé (CAISSE212_STOREFRONT_MODE=off)."
            : `L'intégration admin Caisse212 n'est pas configurée : ${status.missingVariables.join(", ")}`}
        </p>
      </div>
    );
  }

  try {
    const [storefront, menu, catalog] = await Promise.all([
      storefrontAdmin.get(numericId),
      storefrontAdmin.getMenu(numericId).catch(() => null),
      loadPickerCatalog(),
    ]);

    return (
      <StorefrontEditor
        mode="edit"
        initialStorefront={storefront}
        initialMenu={menu}
        catalog={catalog}
        status={status}
      />
    );
  } catch (error) {
    return (
      <div className="admin-card" style={{ borderColor: "#b42318" }}>
        <h2 style={{ marginTop: 0 }}>Site indisponible</h2>
        <p style={{ color: "#ffb4ab", fontSize: 14, marginBottom: 0 }}>
          {storefrontErrorMessage(error)}
        </p>
      </div>
    );
  }
}
