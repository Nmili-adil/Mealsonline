import type {
  StorefrontAdminPayload,
  StorefrontCollectionConfig,
  StorefrontData,
  StorefrontProductOverride,
} from "@/lib/caisse212/storefront/types";

/**
 * Storefront V206 client-side validation. The backend re-validates and its
 * `message` is always displayed; these checks give immediate feedback and
 * prevent obviously invalid full-replacement saves.
 */

export const STOREFRONT_SLUG_MAX = 63;
export const STOREFRONT_NAME_MAX = 120;
export const STOREFRONT_ORIGINS_MAX = 20;
export const STOREFRONT_DATA_MAX_BYTES = 256 * 1024;

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function slugifyStorefrontName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, STOREFRONT_SLUG_MAX);
}

export function isValidStorefrontSlug(slug: string): boolean {
  return (
    slug.length >= 3 &&
    slug.length <= STOREFRONT_SLUG_MAX &&
    SLUG_PATTERN.test(slug) &&
    !slug.startsWith("-") &&
    !slug.endsWith("-")
  );
}

/** `*` or an exact `http(s)://host[:port]` origin with no path/query/hash. */
export function isValidOrigin(origin: string): boolean {
  if (origin === "*") return true;
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

export function dataSizeBytes(data: unknown): number {
  return new TextEncoder().encode(JSON.stringify(data ?? {})).length;
}

export function deepCloneData<T>(data: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(data);
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify(data ?? {})) as T;
}

export function omitEmptyKeys<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out as T;
}

/**
 * Apply a mutation to a storefront `data` object without rebuilding it, so
 * unknown keys survive. The input is deep-cloned first: nested mutations never
 * leak into the previous document.
 */
export function updateStorefrontData(
  data: StorefrontData,
  updater: (draft: StorefrontData) => void,
): StorefrontData {
  const draft = deepCloneData(data ?? {});
  updater(draft);
  return draft;
}

export interface StorefrontIdSets {
  categoryIds: Set<number>;
  productIds: Set<number>;
}

export interface ValidationResult {
  ok: boolean;
  message?: string;
}

const COLLECTION_KNOWN_KEYS = new Set([
  "key",
  "name",
  "description",
  "imageUrl",
  "categoryIds",
  "productIds",
]);

const ALLOWED_OVERRIDE_KEYS = new Set(["name", "description", "imageUrl"]);

export function validateStorefrontData(
  data: unknown,
  ids?: StorefrontIdSets,
): ValidationResult {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, message: "Les données doivent être un objet JSON" };
  }
  const record = data as StorefrontData;

  if (dataSizeBytes(record) > STOREFRONT_DATA_MAX_BYTES) {
    return { ok: false, message: "Les données dépassent 256 Ko" };
  }

  if (record.collections !== undefined) {
    if (!Array.isArray(record.collections)) {
      return { ok: false, message: "collections doit être un tableau" };
    }
    for (const collection of record.collections) {
      const error = validateCollection(collection, ids);
      if (error) return { ok: false, message: error };
    }
  }

  if (record.hiddenProductIds !== undefined) {
    if (!isIntegerArray(record.hiddenProductIds)) {
      return {
        ok: false,
        message: "hiddenProductIds doit être un tableau d'identifiants entiers",
      };
    }
    if (ids) {
      for (const id of record.hiddenProductIds) {
        if (!ids.productIds.has(id)) {
          return { ok: false, message: `Produit inconnu : ${id} (produits masqués)` };
        }
      }
    }
  }

  if (record.productOverrides !== undefined) {
    const overrides = record.productOverrides;
    if (overrides === null || typeof overrides !== "object" || Array.isArray(overrides)) {
      return { ok: false, message: "productOverrides doit être un objet" };
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (!/^\d+$/.test(key)) {
        return { ok: false, message: `Clé de remplacement invalide : ${key}` };
      }
      if (!Number.isInteger(Number(key)) || (ids && !ids.productIds.has(Number(key)))) {
        return { ok: false, message: `Produit inconnu : ${key} (remplacements)` };
      }
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, message: `Remplacement invalide pour le produit ${key}` };
      }
      for (const field of Object.keys(value as StorefrontProductOverride)) {
        if (!ALLOWED_OVERRIDE_KEYS.has(field)) {
          return {
            ok: false,
            message: `Champ non autorisé dans un remplacement : ${field} (le prix ne peut jamais être remplacé)`,
          };
        }
      }
      for (const field of Object.values(value as StorefrontProductOverride)) {
        if (field !== undefined && typeof field !== "string") {
          return { ok: false, message: `Remplacement invalide pour le produit ${key}` };
        }
      }
    }
  }

  return { ok: true };
}

function validateCollection(collection: unknown, ids?: StorefrontIdSets): string | null {
  if (collection === null || typeof collection !== "object" || Array.isArray(collection)) {
    return "Chaque section doit être un objet";
  }
  const config = collection as StorefrontCollectionConfig;
  if (!config.name || !String(config.name).trim()) {
    return "Chaque section doit avoir un nom";
  }
  if (config.categoryIds !== undefined) {
    if (!isIntegerArray(config.categoryIds)) {
      return `Section « ${config.name} » : categoryIds invalides`;
    }
    if (ids) {
      for (const id of config.categoryIds) {
        if (!ids.categoryIds.has(id)) {
          return `Catégorie inconnue : ${id} (section « ${config.name} »)`;
        }
      }
    }
  }
  if (config.productIds !== undefined) {
    if (!isIntegerArray(config.productIds)) {
      return `Section « ${config.name} » : productIds invalides`;
    }
    if (ids) {
      for (const id of config.productIds) {
        if (!ids.productIds.has(id)) {
          return `Produit inconnu : ${id} (section « ${config.name} »)`;
        }
      }
    }
  }
  return null;
}

function isIntegerArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "number" && Number.isInteger(item) && item > 0)
  );
}

export function validateStorefrontPayload(
  payload: StorefrontAdminPayload,
  ids?: StorefrontIdSets,
): ValidationResult {
  if (!payload.name || !payload.name.trim()) {
    return { ok: false, message: "Le nom du site est requis" };
  }
  if (payload.name.length > STOREFRONT_NAME_MAX) {
    return { ok: false, message: "Le nom doit contenir au plus 120 caractères" };
  }
  if (!isValidStorefrontSlug(payload.slug)) {
    return {
      ok: false,
      message:
        "Slug invalide : 3 à 63 caractères, minuscules, chiffres et tirets, sans tiret au début ni à la fin",
    };
  }
  if (!Array.isArray(payload.allowedOrigins)) {
    return { ok: false, message: "allowedOrigins doit être un tableau" };
  }
  if (payload.allowedOrigins.length > STOREFRONT_ORIGINS_MAX) {
    return { ok: false, message: "20 origines maximum" };
  }
  if (payload.allowedOrigins.includes("*") && payload.allowedOrigins.length > 1) {
    return {
      ok: false,
      message: "L'origine « * » ne peut pas être combinée avec d'autres origines",
    };
  }
  for (const origin of payload.allowedOrigins) {
    if (!isValidOrigin(origin)) {
      return {
        ok: false,
        message: `Origine invalide : ${origin} (https://hôte[:port] sans chemin, ou *)`,
      };
    }
  }
  return validateStorefrontData(payload.data, ids);
}

/** Extra (non-standard) keys of a collection, returned as attributes. */
export function collectionAttributes(collection: Record<string, unknown>): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(collection)) {
    if (!COLLECTION_KNOWN_KEYS.has(key)) attributes[key] = value;
  }
  return attributes;
}
