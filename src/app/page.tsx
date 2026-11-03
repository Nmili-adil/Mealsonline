import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteSettings } from "@/lib/site";
import { getStorefrontMode } from "@/lib/caisse212/storefront/mode";
import {
  getConfiguredStorefrontConfig,
  getConfiguredStorefrontMenu,
} from "@/lib/caisse212/storefront/public";
import type { StorefrontConfigResponse, StorefrontMenuResponse } from "@/lib/caisse212/storefront/types";
import {
  safeLogoSrc,
  safeString,
  storefrontThemeStyle,
} from "@/lib/storefront/theme";
import { HomePageClient } from "@/components/store/home/HomePageClient";
import { StorefrontModeBanner } from "@/components/store/StorefrontModeBanner";

export const dynamic = "force-dynamic";

async function loadStorefront(): Promise<{
  config: StorefrontConfigResponse | null;
  menu: StorefrontMenuResponse | null;
  failed: boolean;
}> {
  if (getStorefrontMode() === "off") return { config: null, menu: null, failed: false };
  try {
    const [config, menu] = await Promise.all([
      getConfiguredStorefrontConfig(),
      getConfiguredStorefrontMenu(),
    ]);
    return { config, menu, failed: false };
  } catch {
    // API outage: fall back to CMS content rather than a misleading 404.
    return { config: null, menu: null, failed: true };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const { config } = await loadStorefront();
  const title = config?.data.texts?.heroTitle
    ? `${config.name} | ${String(config.data.texts.heroTitle)}`
    : settings.seo.title;
  const description =
    (config?.data.texts?.heroSubtitle as string | undefined) ?? settings.seo.description;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: process.env.NEXT_PUBLIC_APP_URL,
    },
    alternates: { canonical: process.env.NEXT_PUBLIC_APP_URL || "/" },
  };
}

export default async function HomePage() {
  const settings = await getSiteSettings();
  const { config, menu, failed } = await loadStorefront();

  // A missing/inactive storefront is a genuine public 404; an API outage is
  // not (the shell keeps rendering CMS content and /menu explains the error).
  if (getStorefrontMode() !== "off" && !config && !failed) notFound();

  const texts = config?.data.texts ?? {};
  const theme = config?.data.theme;
  const social = config?.data.social ?? {};

  const heroTitle = safeString(texts.heroTitle);
  const heroSubtitle = safeString(texts.heroSubtitle);
  const logoSrc = safeLogoSrc(theme?.logo);
  const primaryColor =
    theme?.primary && /^#[0-9a-fA-F]{3,8}$/.test(String(theme.primary))
      ? String(theme.primary)
      : undefined;
  const whatsappPhone =
    safeString(social.whatsapp) ?? settings.restaurant.whatsappPhone;

  const featuredProducts = menu
    ? (() => {
        const seen = new Set<number>();
        const products = [];
        for (const collection of menu.collections) {
          for (const product of collection.products) {
            if (seen.has(product.id)) continue;
            seen.add(product.id);
            products.push({
              id: product.id,
              name: product.name,
              description: product.description ?? null,
              imageUrl: product.imageUrl ?? product.thumbUrl ?? null,
              price: product.price,
            });
            if (products.length >= 4) break;
          }
          if (products.length >= 4) break;
        }
        return products;
      })()
    : undefined;

  return (
    <div style={storefrontThemeStyle(theme)}>
      <StorefrontModeBanner />
      <HomePageClient
        heroTitle={heroTitle}
        heroSubtitle={heroSubtitle ?? undefined}
        logoSrc={logoSrc}
        primaryColor={primaryColor}
        whatsappPhone={whatsappPhone}
        restaurantName={config?.name ?? settings.restaurant.name}
        address={settings.restaurant.address}
        featuredProducts={featuredProducts}
        storefrontMode={config !== null}
      />
    </div>
  );
}
