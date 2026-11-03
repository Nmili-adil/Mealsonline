import type { CSSProperties, ReactNode } from "react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { SiteHeader } from "@/components/store/SiteHeader";
import { SiteFooter } from "@/components/store/SiteFooter";
import { WhatsAppButton } from "@/components/store/WhatsAppButton";
import { StorefrontModeBanner } from "@/components/store/StorefrontModeBanner";
import { getSiteSettings } from "@/lib/site";
import { getStorefrontMode } from "@/lib/caisse212/storefront/mode";
import { getConfiguredStorefrontConfig } from "@/lib/caisse212/storefront/public";
import type { StorefrontConfigResponse } from "@/lib/caisse212/storefront/types";

function safeColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : undefined;
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeLogoSrc(value: unknown): string | undefined {
  const src = safeString(value);
  if (!src) return undefined;
  if (src.startsWith("/")) return src;
  return /^https?:\/\//.test(src) ? src : undefined;
}

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();

  let storefront: StorefrontConfigResponse | null = null;
  if (getStorefrontMode() !== "off") {
    try {
      storefront = await getConfiguredStorefrontConfig();
    } catch {
      // The public pages surface their own error states; the shell keeps the
      // site branding from CMS settings rather than crashing every page.
      storefront = null;
    }
  }

  const theme = storefront?.data.theme ?? {};
  const texts = storefront?.data.texts ?? {};
  const social = storefront?.data.social ?? {};
  const primary = safeColor(theme.primary);
  const secondary = safeColor(theme.secondary);
  const logo = safeLogoSrc(theme.logo);
  const font = safeString(theme.font);
  const whatsapp = safeString(social.whatsapp) ?? settings.restaurant.whatsappPhone;

  const style: CSSProperties = {};
  if (primary) {
    (style as Record<string, string>)["--green"] = primary;
    (style as Record<string, string>)["--storefront-primary"] = primary;
  }
  if (secondary) (style as Record<string, string>)["--storefront-secondary"] = secondary;
  if (font && /^[a-zA-Z0-9 ,%-]{1,60}$/.test(font)) {
    (style as Record<string, string>)["--storefront-font"] = font;
  }

  return (
    <div className="site-shell" style={style}>
      <StorefrontModeBanner />
      <AnnouncementBar />
      <SiteHeader logoSrc={logo} restaurantName={storefront?.name ?? settings.restaurant.name} />
      <main style={{ minHeight: "60vh" }}>{children}</main>
      <SiteFooter
        logoSrc={logo}
        restaurantName={storefront?.name ?? settings.restaurant.name}
        address={settings.restaurant.address}
        footerText={safeString(texts.footer)}
        social={social as Record<string, unknown>}
      />
      <WhatsAppButton phone={whatsapp} />
    </div>
  );
}
