import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getDefaultRestaurant, getSiteSettings } from "@/lib/site";
import { loadStorefrontCatalog } from "./catalog-source";
import { StorefrontError } from "./errors";
import { buildStorefrontIdMaps } from "./ids";
import {
  buildStorefrontConfig,
  buildStorefrontMenu,
  buildStorefrontProductDetail,
} from "./menu-builder";
import { assertFixturesAllowed, getStorefrontSlug } from "./mode";
import type {
  StorefrontConfigResponse,
  StorefrontData,
  StorefrontFixtureRecord,
  StorefrontMenuResponse,
  StorefrontProductDetail,
} from "./types";

/**
 * DEV/DEMO fixtures for the Storefront V206 contract.
 *
 * File-backed under `.data/` so the public pages and the admin routes share
 * one state across processes. Never active in production unless the explicit
 * test-only override is set (see mode.ts).
 */

const STATE_DIR = path.join(process.cwd(), ".data");
const STATE_FILE = path.join(STATE_DIR, "storefront-fixtures.json");

interface FixtureState {
  nextId: number;
  storefronts: StorefrontFixtureRecord[];
}

function emptyState(): FixtureState {
  return { nextId: 1, storefronts: [] };
}

async function readState(): Promise<FixtureState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as FixtureState;
    if (!parsed || !Array.isArray(parsed.storefronts)) return emptyState();
    return { nextId: parsed.nextId ?? 1, storefronts: parsed.storefronts };
  } catch {
    return emptyState();
  }
}

async function writeState(state: FixtureState): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, STATE_FILE);
}

/** Test/dev helper: remove the fixture store. */
export async function resetStorefrontFixtures(): Promise<void> {
  await fs.rm(STATE_FILE, { force: true });
}

export function isFixtureOrderingEnabled(): boolean {
  return process.env.CAISSE212_STOREFRONT_ORDERING_ENABLED !== "false";
}

function buildSeedData(
  data: Awaited<ReturnType<typeof loadStorefrontCatalog>>,
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
): StorefrontData {
  const maps = buildStorefrontIdMaps(data);
  const catalogCollections = (() => {
    if (data.categories.length === 0) return undefined;
    const withNumeric = data.categories.map((category) => ({
      category,
      numeric: maps.categories.numericByDbId.get(category.id) ?? 0,
    }));
    const drinks = withNumeric.filter(({ category }) =>
      /boisson|drink|soda|jus/i.test(category.name),
    );
    const food = withNumeric.filter((entry) => !drinks.includes(entry));

    const collections = [];
    if (food.length > 0) {
      collections.push({
        key: "food",
        name: "La carte",
        description: "Nos plats préparés sur place.",
        categoryIds: food.map((entry) => entry.numeric),
      });
    }
    if (drinks.length > 0) {
      collections.push({
        key: "drinks",
        name: "Boissons",
        description: "Pour accompagner votre repas.",
        categoryIds: drinks.map((entry) => entry.numeric),
      });
    }
    return collections;
  })();

  return {
    theme: {
      primary: "#00e83a",
      secondary: "#101513",
      font: "Manrope",
      logo: "/images/logo-mealsonline-clean.png",
    },
    texts: {
      heroTitle: settings.hero.title,
      heroSubtitle: settings.hero.subtitle,
      footer: `${settings.restaurant.name} · ${settings.restaurant.address}, ${settings.restaurant.city}`,
    },
    social: {
      whatsapp: settings.restaurant.whatsappPhone,
    },
    ...(catalogCollections ? { collections: catalogCollections } : {}),
  };
}

/**
 * Ensure the configured storefront slug exists locally. The default record is
 * created from the current site settings + catalog mirror so fixtures reflect
 * a realistic restaurant website.
 */
export async function ensureFixtureStorefront(): Promise<StorefrontFixtureRecord> {
  assertFixturesAllowed();
  const slug = getStorefrontSlug();
  const state = await readState();
  const existing = state.storefronts.find((item) => !item.deleted && item.slug === slug);
  if (existing) return existing;

  const [catalog, settings, restaurant] = await Promise.all([
    loadStorefrontCatalog(),
    getSiteSettings(),
    getDefaultRestaurant(),
  ]);

  const now = new Date().toISOString();
  const record: StorefrontFixtureRecord = {
    id: state.nextId,
    slug,
    name: `${settings.restaurant.name} — site principal`,
    businessId: restaurant.id ? 1 : 1,
    allowedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
    active: true,
    version: 1,
    data: buildSeedData(catalog, settings),
    createdAt: now,
    updatedAt: now,
  };
  state.storefronts.push(record);
  state.nextId += 1;
  await writeState(state);
  return record;
}

export type FixtureBusinessInfo = {
  name: string;
  address: string;
  city: string;
  phone: string;
  coordinates: null;
};

async function loadBusinessInfo(): Promise<FixtureBusinessInfo> {
  const settings = await getSiteSettings();
  return {
    name: settings.restaurant.name,
    address: settings.restaurant.address,
    city: settings.restaurant.city,
    phone: settings.restaurant.phone,
    coordinates: null,
  };
}

function activeRecord(state: FixtureState, slug: string): StorefrontFixtureRecord | null {
  return (
    state.storefronts.find(
      (item) => !item.deleted && item.slug === slug && item.active,
    ) ?? null
  );
}

export async function getFixtureConfig(slug: string): Promise<StorefrontConfigResponse | null> {
  assertFixturesAllowed();
  await ensureFixtureStorefront();
  const state = await readState();
  const record = activeRecord(state, slug);
  if (!record) return null;
  const [catalog, business] = await Promise.all([loadStorefrontCatalog(), loadBusinessInfo()]);
  return buildStorefrontConfig({
    storefront: record,
    catalog,
    business,
    orderingEnabled: isFixtureOrderingEnabled(),
  });
}

export async function getFixtureMenu(slug: string): Promise<StorefrontMenuResponse | null> {
  assertFixturesAllowed();
  await ensureFixtureStorefront();
  const state = await readState();
  const record = activeRecord(state, slug);
  if (!record) return null;
  const catalog = await loadStorefrontCatalog();
  return buildStorefrontMenu({
    storefront: record,
    catalog,
    orderingEnabled: isFixtureOrderingEnabled(),
  });
}

/** Parse `SF-{id}-{slug}` back to the fixture record. */
function recordFromMenuCode(state: FixtureState, menuCode: string): StorefrontFixtureRecord | null {
  const match = /^SF-(\d+)-(.+)$/.exec(menuCode);
  if (!match) return null;
  const id = Number(match[1]);
  const record = state.storefronts.find((item) => item.id === id && !item.deleted);
  if (!record || record.slug !== match[2]) return null;
  return record;
}

export async function getFixtureProductDetail(
  menuCode: string,
  productId: number,
): Promise<StorefrontProductDetail | null> {
  assertFixturesAllowed();
  await ensureFixtureStorefront();
  const state = await readState();
  const record = recordFromMenuCode(state, menuCode);
  if (!record || !record.active) return null;
  const catalog = await loadStorefrontCatalog();
  return buildStorefrontProductDetail({
    storefront: record,
    catalog,
    productId,
  });
}

/** Admin fixture helpers (also used by the preview endpoint). */
export async function readFixtureState(): Promise<FixtureState> {
  return readState();
}

export async function writeFixtureState(state: FixtureState): Promise<void> {
  await writeState(state);
}

export async function getFixtureRecordById(id: number): Promise<StorefrontFixtureRecord> {
  await ensureFixtureStorefront();
  const state = await readState();
  const record = state.storefronts.find((item) => item.id === id && !item.deleted);
  if (!record) {
    throw new StorefrontError("not_found", "Site introuvable", 404);
  }
  return record;
}

export async function getFixtureMenuById(id: number): Promise<StorefrontMenuResponse> {
  const record = await getFixtureRecordById(id);
  const catalog = await loadStorefrontCatalog();
  return buildStorefrontMenu({
    storefront: record,
    catalog,
    orderingEnabled: isFixtureOrderingEnabled(),
  });
}

export async function previewFixtureMenu(
  id: number,
  data: StorefrontData,
): Promise<StorefrontMenuResponse> {
  const record = await getFixtureRecordById(id);
  const catalog = await loadStorefrontCatalog();
  return buildStorefrontMenu({
    storefront: { ...record, data },
    catalog,
    orderingEnabled: isFixtureOrderingEnabled(),
  });
}
