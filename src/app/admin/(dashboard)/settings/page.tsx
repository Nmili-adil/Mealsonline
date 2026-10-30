import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();
  return (
    <div>
      <p style={{ color: "#a3aca6", fontSize: 14, marginTop: 0 }}>
        Paramètres généraux du site (les prix produits restent contrôlés par Caisse212).
      </p>
      <SettingsForm initial={settings} />
    </div>
  );
}
