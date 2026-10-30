import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { SiteHeader } from "@/components/store/SiteHeader";
import { SiteFooter } from "@/components/store/SiteFooter";
import { WhatsAppButton } from "@/components/store/WhatsAppButton";
import { getSiteSettings } from "@/lib/site";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <div className="site-shell">
      <AnnouncementBar />
      <SiteHeader />
      <main style={{ minHeight: "60vh" }}>{children}</main>
      <SiteFooter />
      <WhatsAppButton phone={settings.restaurant.whatsappPhone} />
    </div>
  );
}
