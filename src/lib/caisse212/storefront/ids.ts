import type { StorefrontCatalog } from "./types";

/**
 * Storefront V206 speaks numeric ids (products, variants, modifiers,
 * categories). The website's catalog mirror stores the POS ids as
 * `externalId` strings. Fixtures and the checkout bridge therefore need a
 * stable, deterministic numeric projection of those external ids.
 *
 * The hash is only used for fixtures and for bridging fixture carts to the
 * mirror. In live mode numeric ids are used as returned by Caisse212; the
 * bridge maps them back through `String(id) === externalId` (documented
 * assumption, see docs/STOREFRONT_V206.md).
 */

export type StorefrontKind =
  | "category"
  | "product"
  | "variant"
  | "modifier_group"
  | "modifier";

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function storefrontNumericId(kind: StorefrontKind, externalId: string): number {
  return 1 + (fnv1a(`${kind}:${externalId}`) % 1_000_000_000);
}

export interface NumericIdEntry {
  dbId: string;
  externalId: string | null;
}

/**
 * Assign numeric ids to a set of rows, resolving the (very unlikely) hash
 * collisions deterministically by sorted key.
 */
export function assignNumericIds(
  kind: StorefrontKind,
  entries: NumericIdEntry[],
): {
  numericByDbId: Map<string, number>;
  dbIdByNumeric: Map<number, string>;
  externalIdByNumeric: Map<number, string | null>;
} {
  const numericByDbId = new Map<string, number>();
  const dbIdByNumeric = new Map<number, string>();
  const externalIdByNumeric = new Map<number, string | null>();

  const sorted = [...entries]
    .map((entry) => ({
      ...entry,
      key: entry.externalId ?? `db:${entry.dbId}`,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  for (const entry of sorted) {
    let numeric = storefrontNumericId(kind, entry.key);
    while (dbIdByNumeric.has(numeric) && dbIdByNumeric.get(numeric) !== entry.dbId) {
      numeric += 1;
    }
    numericByDbId.set(entry.dbId, numeric);
    dbIdByNumeric.set(numeric, entry.dbId);
    externalIdByNumeric.set(numeric, entry.externalId);
  }

  return { numericByDbId, dbIdByNumeric, externalIdByNumeric };
}

export interface StorefrontIdMaps {
  categories: ReturnType<typeof assignNumericIds>;
  products: ReturnType<typeof assignNumericIds>;
  variants: ReturnType<typeof assignNumericIds>;
  modifierGroups: ReturnType<typeof assignNumericIds>;
  modifiers: ReturnType<typeof assignNumericIds>;
}

export function buildStorefrontIdMaps(catalog: StorefrontCatalog): StorefrontIdMaps {
  const variants = catalog.products.flatMap((product) =>
    product.variants.map((variant) => ({
      dbId: variant.id,
      externalId: variant.externalId,
    })),
  );
  const groups = catalog.products.flatMap((product) =>
    product.modifierGroups.map((group) => ({
      dbId: group.id,
      externalId: group.externalId,
    })),
  );
  const modifiers = catalog.products.flatMap((product) =>
    product.modifierGroups.flatMap((group) =>
      group.modifiers.map((modifier) => ({
        dbId: modifier.id,
        externalId: modifier.externalId,
      })),
    ),
  );

  return {
    categories: assignNumericIds(
      "category",
      catalog.categories.map((category) => ({
        dbId: category.id,
        externalId: category.externalId,
      })),
    ),
    products: assignNumericIds(
      "product",
      catalog.products.map((product) => ({
        dbId: product.id,
        externalId: product.externalId,
      })),
    ),
    variants: assignNumericIds("variant", variants),
    modifierGroups: assignNumericIds("modifier_group", groups),
    modifiers: assignNumericIds("modifier", modifiers),
  };
}
