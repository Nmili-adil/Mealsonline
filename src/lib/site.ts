import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_RESTAURANT_SLUG, SYNC_INTERVAL_MINUTES } from "@/lib/constants";
import { jsonParse, jsonStringify } from "@/lib/utils";

export interface SiteSettings {
  announcement: {
    enabled: boolean;
    message: string;
  };
  hero: {
    title: string;
    subtitle: string;
    imageUrl: string;
  };
  restaurant: {
    name: string;
    tagline: string;
    description: string;
    address: string;
    city: string;
    phone: string;
    whatsappPhone: string;
    openingHours: string;
  };
  seo: {
    title: string;
    description: string;
  };
  featured: {
    brandSlugs: string[];
    categorySlugs: string[];
    productSlugs: string[];
  };
}

export const defaultSiteSettings: SiteSettings = {
  announcement: {
    enabled: false,
    message: "Livraison offerte dès 100 MAD ce week-end",
  },
  hero: {
    title: "Trois envies. Une seule adresse.",
    subtitle:
      "Pizza artisanale, pasta généreuse et smash burgers, préparés à Hay Izdihar.",
    imageUrl: "/images/hero-mealsonline.png",
  },
  restaurant: {
    name: "MealsOnline",
    tagline: "Trois envies. Une seule adresse.",
    description:
      "PizzaHub, CIAO PASTA et Smash It Burgers réunis dans un même lieu à Hay Izdihar, Marrakech. Sur place, à emporter ou en livraison.",
    address: "Hay Izdihar, Marrakech",
    city: "Marrakech",
    phone: "+212 6 00 00 00 00",
    whatsappPhone: "+212600000000",
    openingHours: "Tous les jours · 11h00 – 23h00",
  },
  seo: {
    title: "MealsOnline | Trois envies. Une seule adresse.",
    description:
      "PizzaHub, CIAO PASTA et Smash It Burgers, préparés à Hay Izdihar, Marrakech. Commande en ligne, livraison et retrait.",
  },
  featured: {
    brandSlugs: [],
    categorySlugs: [],
    productSlugs: [],
  },
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["site.announcement", "site.hero", "site.restaurant", "site.seo", "site.featured"] } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    announcement: jsonParse(map.get("site.announcement"), defaultSiteSettings.announcement),
    hero: jsonParse(map.get("site.hero"), defaultSiteSettings.hero),
    restaurant: jsonParse(map.get("site.restaurant"), defaultSiteSettings.restaurant),
    seo: jsonParse(map.get("site.seo"), defaultSiteSettings.seo),
    featured: jsonParse(map.get("site.featured"), defaultSiteSettings.featured),
  };
}

export async function saveSiteSettings(
  section: keyof SiteSettings,
  value: unknown,
): Promise<void> {
  await prisma.setting.upsert({
    where: { key: `site.${section}` },
    create: { key: `site.${section}`, value: jsonStringify(value) },
    update: { value: jsonStringify(value) },
  });
}

export async function ensureDefaultRestaurant() {
  const settings = await getSiteSettings();
  const existing = await prisma.restaurant.findUnique({
    where: { slug: DEFAULT_RESTAURANT_SLUG },
  });
  if (existing) {
    // Keep contact details in sync with CMS-managed values.
    return prisma.restaurant.update({
      where: { id: existing.id },
      data: {
        name: settings.restaurant.name,
        address: settings.restaurant.address,
        city: settings.restaurant.city,
        phone: settings.restaurant.phone,
        whatsappPhone: settings.restaurant.whatsappPhone,
        openingHours: settings.restaurant.openingHours,
      },
    });
  }
  return prisma.restaurant.create({
    data: {
      name: settings.restaurant.name,
      slug: DEFAULT_RESTAURANT_SLUG,
      tagline: settings.restaurant.tagline,
      description: settings.restaurant.description,
      address: settings.restaurant.address,
      city: settings.restaurant.city,
      phone: settings.restaurant.phone,
      whatsappPhone: settings.restaurant.whatsappPhone,
      openingHours: settings.restaurant.openingHours,
      currency: "MAD",
      deliveryFee: 1000, // 10 MAD, minor units
      isActive: true,
    },
  });
}

export async function getDefaultRestaurant() {
  return prisma.restaurant.findUniqueOrThrow({
    where: { slug: DEFAULT_RESTAURANT_SLUG },
  });
}

export function getSyncIntervalMinutes(): number {
  return SYNC_INTERVAL_MINUTES;
}
