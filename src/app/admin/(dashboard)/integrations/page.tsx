import type { Metadata } from "next";
import { getIntegrationHealth } from "@/lib/caisse212/client";
import { IntegrationsPanel } from "@/components/admin/IntegrationsPanel";

export const metadata: Metadata = { title: "Intégrations" };
export const dynamic = "force-dynamic";

export default function AdminIntegrationsPage() {
  const health = getIntegrationHealth();
  return <IntegrationsPanel initial={health} />;
}
