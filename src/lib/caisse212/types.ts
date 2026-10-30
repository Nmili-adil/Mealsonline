/**
 * Caisse212 integration contracts (website side).
 *
 * All monetary values are integer minor units (centimes of MAD).
 * These interfaces describe the *website's* adapter boundary. The concrete
 * endpoint paths and payload shapes are PROPOSED and must be confirmed with
 * the Caisse212 partner — see docs/CAISSE212_API_CONTRACT.md.
 */

export interface Caisse212Brand {
  externalId: string;
  name: string;
  tagline?: string;
  logoUrl?: string;
  imageUrl?: string;
  accentColor?: string;
  sortOrder?: number;
  active?: boolean;
}

export interface Caisse212Category {
  externalId: string;
  brandExternalId?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  active?: boolean;
}

export interface Caisse212Product {
  externalId: string;
  brandExternalId?: string;
  categoryExternalId?: string;
  name: string;
  description?: string;
  ingredients?: string[];
  imageUrl?: string;
  available: boolean;
  sortOrder?: number;
  variants: Caisse212Variant[];
  /** External IDs of the modifier groups attached to this product. */
  modifierGroupExternalIds?: string[];
}

export interface Caisse212Variant {
  externalId: string;
  name: string;
  price: number; // minor units — POS authoritative
  isDefault?: boolean;
  sortOrder?: number;
}

export interface Caisse212ModifierGroup {
  externalId: string;
  name: string;
  minSelection: number;
  maxSelection: number;
  required: boolean;
  sortOrder?: number;
  modifiers: Caisse212Modifier[];
}

export interface Caisse212Modifier {
  externalId: string;
  name: string;
  price: number; // minor units
  sortOrder?: number;
}

export interface CatalogSnapshot {
  generatedAt: string;
  brands: Caisse212Brand[];
  categories: Caisse212Category[];
  products: Caisse212Product[];
  modifierGroups: Caisse212ModifierGroup[];
}

export interface CatalogChanges {
  /** Opaque cursor; the next incremental call passes it back. */
  cursor: string;
  generatedAt: string;
  /** Full entity payloads for upserts. */
  upserts: CatalogSnapshot;
  /** External IDs removed from the POS since the previous cursor. */
  removed: {
    brands: string[];
    categories: string[];
    products: string[];
  };
}

export interface AvailabilityItem {
  externalProductId: string;
  available: boolean;
}

export interface AvailabilitySnapshot {
  generatedAt: string;
  items: AvailabilityItem[];
}

export interface SubmitOrderLine {
  externalProductId: string;
  externalVariantId: string;
  quantity: number;
  /** Selected modifier external IDs (POS authoritative pricing). */
  externalModifierIds: string[];
  notes?: string;
  /** Website-side estimated unit price, for the POS to compare. */
  unitPrice: number;
}

export interface SubmitOrderInput {
  externalOrderId: string;
  restaurantExternalId?: string;
  brandExternalId?: string;
  fulfillmentType: "delivery" | "pickup";
  customer: {
    name: string;
    phone: string;
  };
  delivery?: {
    address?: string;
    instructions?: string;
  };
  orderNote?: string;
  paymentMethod: string;
  currency: string;
  /** Website-computed total in minor units (POS remains authoritative). */
  expectedTotal: number;
  /** Set when the website already revalidated prices and accepts POS repricing. */
  acceptRepricing?: boolean;
  lines: SubmitOrderLine[];
}

export interface SubmitOrderResult {
  accepted: boolean;
  externalOrderId: string;
  posOrderId?: string;
  /** POS-authoritative total when different from expectedTotal. */
  authoritativeTotal?: number;
  /** True when the POS total differs from the submitted total. */
  repriced?: boolean;
  rejectionReason?: string;
  acceptedAt?: string;
}

export type ExternalAcceptanceState =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired";
export type ExternalPreparationState =
  | "pending"
  | "preparing"
  | "ready"
  | "dispatched"
  | "delivered";
export type ExternalFulfillmentState =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface ExternalOrderStatus {
  externalOrderId: string;
  posOrderId?: string;
  acceptance: ExternalAcceptanceState;
  preparation: ExternalPreparationState;
  fulfillment: ExternalFulfillmentState;
  payment?: "pending" | "paid" | "failed" | "refunded";
  updatedAt: string;
}

export interface Caisse212CatalogProvider {
  fetchCatalog(): Promise<CatalogSnapshot>;
  fetchChanges(cursor?: string): Promise<CatalogChanges>;
  getAvailability(): Promise<AvailabilitySnapshot>;
}

export interface Caisse212OrderProvider {
  submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult>;
  getOrderByExternalId(externalOrderId: string): Promise<ExternalOrderStatus | null>;
  getOrderStatus(posOrderId: string): Promise<ExternalOrderStatus | null>;
}

export interface Caisse212Provider
  extends Caisse212CatalogProvider,
    Caisse212OrderProvider {}

/** Structured integration errors with safe, user-presentable messages. */
export type Caisse212ErrorCode =
  | "not_configured"
  | "timeout"
  | "unavailable"
  | "rejected"
  | "validation"
  | "stale_price"
  | "product_unavailable"
  | "duplicate"
  | "auth_failed"
  | "unexpected";

export class Caisse212Error extends Error {
  readonly code: Caisse212ErrorCode;
  readonly correlationId?: string;
  readonly retryable: boolean;

  constructor(
    code: Caisse212ErrorCode,
    message: string,
    options: { correlationId?: string; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "Caisse212Error";
    this.code = code;
    this.correlationId = options.correlationId;
    this.retryable = options.retryable ?? false;
  }
}
