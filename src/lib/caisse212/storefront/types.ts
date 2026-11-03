/**
 * Caisse212 Storefront API (backend V206) — website-side contracts.
 *
 * Public endpoints are unauthenticated and read-only. All storefront `data`
 * is public by design: never put secrets in it.
 *
 * Money: integer minor units (centimes of MAD), matching the rest of the
 * website integration. The live API's monetary unit must be confirmed against
 * real responses (see docs/STOREFRONT_V206.md).
 */

export interface StorefrontTheme {
  primary?: string;
  secondary?: string;
  logo?: string;
  font?: string;
  [key: string]: unknown;
}

export interface StorefrontTexts {
  heroTitle?: string;
  heroSubtitle?: string;
  footer?: string;
  [key: string]: unknown;
}

export interface StorefrontSocial {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  whatsapp?: string;
  [key: string]: unknown;
}

export interface StorefrontCollectionConfig {
  key?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  categoryIds?: number[];
  productIds?: number[];
  /** Extra website keys, returned as `attributes` in the menu. */
  [key: string]: unknown;
}

export interface StorefrontProductOverride {
  name?: string;
  description?: string;
  imageUrl?: string;
}

export interface StorefrontData {
  theme?: StorefrontTheme;
  texts?: StorefrontTexts;
  social?: StorefrontSocial;
  /**
   * Absent = use the business's real categories as sections.
   * [] = explicitly no sections.
   */
  collections?: StorefrontCollectionConfig[];
  hiddenProductIds?: number[];
  /** Display name/description/image only — prices can never be overridden. */
  productOverrides?: Record<string, StorefrontProductOverride>;
  [key: string]: unknown;
}

export interface StorefrontBusiness {
  name?: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  coordinates?: unknown;
  [key: string]: unknown;
}

export interface StorefrontConfigResponse {
  slug: string;
  name: string;
  version: number;
  menuCode: string;
  orderingEnabled: boolean;
  business: StorefrontBusiness;
  data: StorefrontData;
}

export interface StorefrontMenuProduct {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  price: number;
  tvaPct?: number;
}

export interface StorefrontMenuCollection {
  key?: string | null;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  categoryId?: number | null;
  attributes?: Record<string, unknown>;
  products: StorefrontMenuProduct[];
}

export interface StorefrontMenuResponse {
  collections: StorefrontMenuCollection[];
  tvaPct: number;
  currency: string;
  orderingEnabled: boolean;
  menuCode: string;
  version: number;
}

export interface StorefrontVariant {
  id: number;
  name: string;
  price: number;
  isDefault?: boolean;
}

export interface StorefrontModifier {
  id: number;
  name: string;
  price: number;
}

export interface StorefrontModifierGroup {
  id: number;
  name: string;
  minSelection: number;
  maxSelection: number;
  required: boolean;
  modifiers: StorefrontModifier[];
}

/**
 * Product detail shape for GET /api/public/menu/{menuCode}/products/{id}.
 *
 * ASSUMED CONTRACT: the V206 document describes this endpoint as returning
 * "variants + modifier options" but does not publish a schema. This shape is
 * the documented assumption used by the adapter; live responses are validated
 * at runtime and a mismatch surfaces a clear error instead of fabricated data.
 */
export interface StorefrontProductDetail {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  variants: StorefrontVariant[];
  modifierGroups: StorefrontModifierGroup[];
}

/** Admin API request payload (POST / PUT — PUT is a full replacement). */
export interface StorefrontAdminPayload {
  slug: string;
  name: string;
  businessId?: number;
  allowedOrigins: string[];
  active: boolean;
  data: StorefrontData;
}

export interface StorefrontAdminRecord extends StorefrontAdminPayload {
  id: number;
  version: number;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
}

/** Catalog provider shape used by fixtures, the menu builder and pickers. */
export interface CatalogVariantRow {
  id: string;
  externalId: string | null;
  name: string;
  price: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface CatalogModifierRow {
  id: string;
  externalId: string | null;
  name: string;
  price: number;
  sortOrder: number;
}

export interface CatalogModifierGroupRow {
  id: string;
  externalId: string | null;
  name: string;
  minSelection: number;
  maxSelection: number;
  required: boolean;
  sortOrder: number;
  modifiers: CatalogModifierRow[];
}

export interface CatalogProductRow {
  id: string;
  externalId: string | null;
  categoryId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  available: boolean;
  variants: CatalogVariantRow[];
  modifierGroups: CatalogModifierGroupRow[];
}

export interface CatalogCategoryRow {
  id: string;
  externalId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

export interface StorefrontCatalog {
  currency: string;
  categories: CatalogCategoryRow[];
  products: CatalogProductRow[];
}

export interface StorefrontFixtureRecord {
  id: number;
  slug: string;
  name: string;
  businessId: number;
  allowedOrigins: string[];
  active: boolean;
  version: number;
  data: StorefrontData;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}
