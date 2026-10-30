import "server-only";

/**
 * Status transition rules for online orders.
 *
 * Four independent dimensions are maintained separately (acceptance,
 * preparation, payment, fulfillment) and a single human-facing `status` is
 * derived from them. The map below enforces allowed webhook-driven
 * transitions; invalid transitions are rejected (with a log entry) rather
 * than silently applied.
 */

export type DimensionState = string;

const TRANSITIONS: Record<string, Record<string, string[]>> = {
  acceptance: {
    pending: ["accepted", "rejected", "expired"],
    accepted: [],
    rejected: [],
    expired: [],
  },
  preparation: {
    pending: ["preparing"],
    preparing: ["ready"],
    ready: ["dispatched"],
    dispatched: ["delivered"],
    delivered: [],
  },
  fulfillment: {
    pending: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  },
  payment: {
    pending: ["paid", "failed"],
    paid: ["refunded"],
    failed: [],
    refunded: [],
  },
};

export interface StatusEventInput {
  eventType: string;
  order: {
    status: string;
    acceptanceState: string;
    preparationState: string;
    paymentState: string;
    fulfillmentState: string;
  };
}

export interface StatusEventEffect {
  updates: {
    status?: string;
    acceptanceState?: string;
    preparationState?: string;
    paymentState?: string;
    fulfillmentState?: string;
    acceptedAt?: Date;
  };
  error?: string;
}

/** Map a proposed webhook event type to dimension updates. */
export function eventEffect(
  eventType: string,
  order: StatusEventInput["order"],
): StatusEventEffect {
  switch (eventType) {
    case "order.accepted":
      return transition("acceptance", order, "accepted", { acceptedAt: new Date() });
    case "order.rejected":
      return transition("acceptance", order, "rejected");
    case "order.preparing":
      return transition("preparation", order, "preparing");
    case "order.ready":
      return transition("preparation", order, "ready");
    case "order.dispatched":
      return transition("preparation", order, "dispatched");
    case "order.delivered":
      return transition("preparation", order, "delivered");
    case "order.cancelled":
      return transition("fulfillment", order, "cancelled");
    case "order.expired":
      return transition("acceptance", order, "expired");
    default:
      return { updates: {}, error: `Type d'événement inconnu: ${eventType}` };
  }
}

function transition(
  dimension: "acceptance" | "preparation" | "payment" | "fulfillment",
  order: StatusEventInput["order"],
  target: string,
  extras: { acceptedAt?: Date } = {},
): StatusEventEffect {
  const current =
    dimension === "acceptance"
      ? order.acceptanceState
      : dimension === "preparation"
        ? order.preparationState
        : dimension === "payment"
          ? order.paymentState
          : order.fulfillmentState;

  const allowed = TRANSITIONS[dimension][current] ?? [];
  if (current === target) {
    // Idempotent replay of the same state — accepted without change.
    return { updates: { ...deriveStatus(order, dimension, target), ...extras } };
  }
  if (!allowed.includes(target)) {
    return {
      updates: {},
      error: `Transition ${dimension} invalide: ${current} -> ${target}`,
    };
  }

  const nextOrder = { ...order, [dimensionStateKey(dimension)]: target };
  return {
    updates: { ...deriveStatus(nextOrder, dimension, target), ...extras },
  };
}

function dimensionStateKey(
  dimension: "acceptance" | "preparation" | "payment" | "fulfillment",
): "acceptanceState" | "preparationState" | "paymentState" | "fulfillmentState" {
  return `${dimension}State` as const;
}

function deriveStatus(
  order: StatusEventInput["order"],
  dimension: "acceptance" | "preparation" | "payment" | "fulfillment",
  target: string,
): Partial<StatusEventEffect["updates"]> {
  const next = { ...order, [dimensionStateKey(dimension)]: target };
  return {
    status: computeOrderStatus(
      next.acceptanceState,
      next.preparationState,
      next.paymentState,
      next.fulfillmentState,
    ),
    [dimensionStateKey(dimension)]: target,
  } as Partial<StatusEventEffect["updates"]>;
}

/**
 * Derive the single human-facing status from the four dimensions.
 * Acceptance dominates; preparation/fulfillment refine the display.
 */
export function computeOrderStatus(
  acceptance: string,
  preparation: string,
  payment: string,
  fulfillment: string,
): string {
  if (acceptance === "rejected") return "rejected";
  if (acceptance === "expired") return "expired";
  if (acceptance !== "accepted") return "pending_submission";
  if (fulfillment === "cancelled") return "cancelled";
  if (preparation === "delivered" || fulfillment === "completed") return "delivered";
  if (preparation === "dispatched") return "dispatched";
  if (preparation === "ready") return "ready";
  if (preparation === "preparing") return "preparing";
  return "accepted";
}

/** Validate whether a transition would be allowed (pure, for tests). */
export function isTransitionAllowed(
  dimension: "acceptance" | "preparation" | "payment" | "fulfillment",
  current: string,
  target: string,
): boolean {
  return (TRANSITIONS[dimension][current] ?? []).includes(target);
}
