import type {
  CatalogProductRow,
  StorefrontAdminRecord,
  StorefrontCatalog,
  StorefrontConfigResponse,
  StorefrontFixtureRecord,
  StorefrontMenuCollection,
  StorefrontMenuProduct,
  StorefrontMenuResponse,
  StorefrontProductDetail,
} from "./types";
import { buildStorefrontIdMaps } from "./ids";

/**
 * Pure implementation of the documented V206 menu semantics, used by the
 * local fixtures (and by tests). The live backend applies the same rules; the
 * website renders whatever the live API returns without re-deriving it.
 *
 * Rules implemented:
 *  - `collections` absent  → real categories as sections
 *  - `collections: []`     → no sections
 *  - custom collections    → category products (category order, name order)
 *                            then explicit productIds, deduplicated
 *  - hidden products removed, empty collections omitted
 *  - overrides apply to name/description/image only, never price
 */

export const STOREFRONT_TVA_PCT = 20;

const KNOWN_COLLECTION_KEYS = new Set([
  "key",
  "name",
  "description",
  "imageUrl",
  "categoryIds",
  "productIds",
]);

function productPrice(product: CatalogProductRow): number {
  const preferred =
    product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
  return preferred?.price ?? 0;
}

function productNumericId(
  maps: ReturnType<typeof buildStorefrontIdMaps>,
  product: CatalogProductRow,
): number | null {
  return maps.products.numericByDbId.get(product.id) ?? null;
}

function toMenuProduct(
  product: CatalogProductRow,
  numericId: number,
  data: StorefrontFixtureRecord["data"],
): StorefrontMenuProduct {
  const override = data.productOverrides?.[String(numericId)];
  const imageUrl = override?.imageUrl ?? product.imageUrl ?? null;
  return {
    id: numericId,
    name: override?.name ?? product.name,
    description: override?.description ?? product.description,
    imageUrl,
    thumbUrl: imageUrl,
    price: productPrice(product),
    tvaPct: STOREFRONT_TVA_PCT,
  };
}

function collectionAttributes(collection: Record<string, unknown>): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(collection)) {
    if (!KNOWN_COLLECTION_KEYS.has(key)) attributes[key] = value;
  }
  return attributes;
}

export function buildStorefrontMenu(input: {
  storefront: StorefrontFixtureRecord;
  catalog: StorefrontCatalog;
  orderingEnabled?: boolean;
}): StorefrontMenuResponse {
  const { storefront, catalog } = input;
  const maps = buildStorefrontIdMaps(catalog);
  const data = storefront.data ?? {};

  const categories = [...catalog.categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  const categoryOrder = new Map(categories.map((category, index) => [category.id, index]));

  const products = catalog.products.filter((product) => product.available);
  const productsByCategory = new Map<string, CatalogProductRow[]>();
  for (const product of products) {
    if (!product.categoryId || !categoryOrder.has(product.categoryId)) continue;
    const list = productsByCategory.get(product.categoryId) ?? [];
    list.push(product);
    productsByCategory.set(product.categoryId, list);
  }
  for (const list of productsByCategory.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name) || a.sortOrder - b.sortOrder);
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const productByNumeric = new Map<number, CatalogProductRow>();
  for (const product of products) {
    const numeric = productNumericId(maps, product);
    if (numeric !== null) productByNumeric.set(numeric, product);
  }

  const hidden = new Set(data.hiddenProductIds ?? []);
  const seen = new Set<string>();

  const pushProduct = (
    target: StorefrontMenuProduct[],
    product: CatalogProductRow,
  ) => {
    const numeric = productNumericId(maps, product);
    if (numeric === null) return;
    if (seen.has(product.id) || hidden.has(numeric)) return;
    seen.add(product.id);
    target.push(toMenuProduct(product, numeric, data));
  };

  const collections: StorefrontMenuCollection[] = [];

  if (data.collections === undefined) {
    // Absent key: use the business's real categories.
    for (const category of categories) {
      const rows = productsByCategory.get(category.id) ?? [];
      if (rows.length === 0) continue;
      const categoryNumeric = maps.categories.numericByDbId.get(category.id) ?? null;
      const sectionProducts: StorefrontMenuProduct[] = [];
      for (const product of rows) pushProduct(sectionProducts, product);
      if (sectionProducts.length === 0) continue;
      collections.push({
        key: categoryNumeric !== null ? `category-${categoryNumeric}` : null,
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
        categoryId: categoryNumeric,
        attributes: {},
        products: sectionProducts,
      });
    }
  } else {
    for (const collection of data.collections) {
      const sectionProducts: StorefrontMenuProduct[] = [];

      for (const categoryNumeric of collection.categoryIds ?? []) {
        const categoryId = maps.categories.dbIdByNumeric.get(categoryNumeric);
        if (!categoryId) continue;
        for (const product of productsByCategory.get(categoryId) ?? []) {
          pushProduct(sectionProducts, product);
        }
      }
      for (const productNumeric of collection.productIds ?? []) {
        const product = productByNumeric.get(productNumeric);
        if (product) pushProduct(sectionProducts, product);
      }

      // Empty collections are not returned.
      if (sectionProducts.length === 0) continue;

      collections.push({
        key: collection.key ?? null,
        name: collection.name,
        description: collection.description ?? null,
        imageUrl: collection.imageUrl ?? null,
        categoryId: null,
        attributes: collectionAttributes(collection as Record<string, unknown>),
        products: sectionProducts,
      });
    }
  }

  return {
    collections,
    tvaPct: STOREFRONT_TVA_PCT,
    currency: catalog.currency,
    orderingEnabled: input.orderingEnabled ?? true,
    menuCode: `SF-${storefront.id}-${storefront.slug}`,
    version: storefront.version,
  };
}

export function buildStorefrontConfig(input: {
  storefront: StorefrontFixtureRecord;
  catalog: StorefrontCatalog;
  business: StorefrontConfigResponse["business"];
  orderingEnabled?: boolean;
}): StorefrontConfigResponse {
  return {
    slug: input.storefront.slug,
    name: input.storefront.name,
    version: input.storefront.version,
    menuCode: `SF-${input.storefront.id}-${input.storefront.slug}`,
    orderingEnabled: input.orderingEnabled ?? true,
    business: input.business,
    data: input.storefront.data ?? {},
  };
}

export function buildStorefrontProductDetail(input: {
  storefront: StorefrontFixtureRecord;
  catalog: StorefrontCatalog;
  productId: number;
}): StorefrontProductDetail | null {
  const maps = buildStorefrontIdMaps(input.catalog);
  const dbId = maps.products.dbIdByNumeric.get(input.productId);
  if (!dbId) return null;

  const product = input.catalog.products.find((row) => row.id === dbId);
  if (!product || !product.available) return null;

  const override = input.storefront.data?.productOverrides?.[String(input.productId)];
  const imageUrl = override?.imageUrl ?? product.imageUrl ?? null;

  return {
    id: input.productId,
    name: override?.name ?? product.name,
    description: override?.description ?? product.description,
    imageUrl,
    variants: product.variants
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((variant) => ({
        id: maps.variants.numericByDbId.get(variant.id) ?? 0,
        name: variant.name,
        price: variant.price,
        isDefault: variant.isDefault,
      })),
    modifierGroups: product.modifierGroups
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((group) => ({
        id: maps.modifierGroups.numericByDbId.get(group.id) ?? 0,
        name: group.name,
        minSelection: group.minSelection,
        maxSelection: group.maxSelection,
        required: group.required,
        modifiers: group.modifiers
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((modifier) => ({
            id: maps.modifiers.numericByDbId.get(modifier.id) ?? 0,
            name: modifier.name,
            price: modifier.price,
          })),
      })),
  };
}

/** Admin record with the public URL, derived per the documented base path. */
export function toAdminRecord(
  record: StorefrontFixtureRecord,
  publicBaseUrl: string,
): StorefrontAdminRecord {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    businessId: record.businessId,
    allowedOrigins: record.allowedOrigins,
    active: record.active,
    version: record.version,
    data: record.data,
    publicUrl: `${publicBaseUrl.replace(/\/$/, "")}/api/public/storefront/${record.slug}`,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
