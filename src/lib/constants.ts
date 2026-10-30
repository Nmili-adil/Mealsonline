export const DEFAULT_RESTAURANT_SLUG = "mealsonline";

export const FULFILLMENT_TYPES = ["delivery", "pickup"] as const;
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export const PAYMENT_METHODS = [
  { value: "cash_on_delivery", label: "Paiement à la livraison" },
  { value: "pay_at_pickup", label: "Paiement au retrait" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const ORDER_STATUSES = [
  "pending_submission",
  "submitted",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
  "failed",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ACCEPTANCE_STATES = [
  "pending",
  "accepted",
  "rejected",
  "expired",
] as const;

export const PREPARATION_STATES = [
  "pending",
  "preparing",
  "ready",
  "dispatched",
  "delivered",
] as const;

export const PAYMENT_STATES = ["pending", "paid", "failed", "refunded"] as const;
export const FULFILLMENT_STATES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const;

/**
 * Webhook event types proposed for the Caisse212 contract. These are logical
 * event names and must be mapped to the real POS event names when confirmed.
 */
export const WEBHOOK_EVENT_TYPES = [
  "order.accepted",
  "order.rejected",
  "order.preparing",
  "order.ready",
  "order.dispatched",
  "order.delivered",
  "order.cancelled",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const ACCEPTANCE_TIMEOUT_SECONDS = (() => {
  const parsed = Number(process.env.ORDER_ACCEPTANCE_TIMEOUT_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180;
})();

export const SYNC_INTERVAL_MINUTES = (() => {
  const parsed = Number(process.env.CAISSE212_SYNC_INTERVAL_MINUTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
})();

export const AUTH_COOKIE_NAME = "mlo_admin_session";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const TRACKING_HEADER_NAME = "x-tracking-token";
