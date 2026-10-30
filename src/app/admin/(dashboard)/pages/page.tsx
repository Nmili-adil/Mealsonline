import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Contenu du site" };
export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  const settings = await getSiteSettings();
  return <SettingsForm initial={settings} />;
}
