import "server-only";
import { prisma } from "@/lib/prisma";
import {
  lookupOrderByExternalId,
  lookupOrderByPosId,
} from "@/lib/caisse212/orders";
import { eventEffect } from "./transitions";

/**
 * Background reconciliation for missed or out-of-order webhook events.
 *
 * For every order that is not in a terminal state, ask Caisse212 for the
 * current status (by POS order ID when known, otherwise by external ID) and
 * replay the corresponding state transitions locally.
 */
export async function reconcileOrderStatuses(): Promise<{
  checked: number;
  updated: number;
  failed: number;
}> {
  const orders = await prisma.onlineOrder.findMany({
    where: {
      status: { in: ["pending_submission", "submitted", "accepted", "preparing", "ready", "dispatched"] },
    },
    take: 100,
    orderBy: { updatedAt: "asc" },
  });

  let checked = 0;
  let updated = 0;
  let failed = 0;

  for (const order of orders) {
    checked += 1;
    try {
      const external = order.posOrderId
        ? await lookupOrderByPosId(order.posOrderId)
        : order.externalOrderId
          ? await lookupOrderByExternalId(order.externalOrderId)
          : null;
      if (!external) continue;

      const events: Array<{ type: string; toState: string }> = [];
      if (external.acceptance === "accepted" && order.acceptanceState !== "accepted") {
        events.push({ type: "order.accepted", toState: "accepted" });
      }
      if (external.acceptance === "rejected" && order.acceptanceState !== "rejected") {
        events.push({ type: "order.rejected", toState: "rejected" });
      }
      if (external.acceptance === "expired" && order.acceptanceState !== "expired") {
        events.push({ type: "order.expired", toState: "expired" });
      }
      const prepChain = ["preparing", "ready", "dispatched", "delivered"];
      const prepIndex = prepChain.indexOf(external.preparation);
      const currentIndex = prepChain.indexOf(order.preparationState);
      if (prepIndex > currentIndex) {
        for (let i = currentIndex + 1; i <= prepIndex; i += 1) {
          events.push({ type: `order.${prepChain[i]}`, toState: prepChain[i] });
        }
      }
      if (external.fulfillment === "cancelled" && order.fulfillmentState !== "cancelled") {
        events.push({ type: "order.cancelled", toState: "cancelled" });
      }

      for (const event of events) {
        const applied = await applyEventIfAllowed(order.id, event.type);
        if (applied) updated += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { checked, updated, failed };
}

/** Apply a status event only when the transition is valid; returns true when applied. */
export async function applyEventIfAllowed(
  orderId: string,
  eventType: string,
): Promise<boolean> {
  const order = await prisma.onlineOrder.findUnique({ where: { id: orderId } });
  if (!order) return false;

  const effect = eventEffect(eventType, order);
  if (effect.error) return false;
  if (Object.keys(effect.updates).length === 0) return false;

  const updates = effect.updates;
  await prisma.$transaction(async (tx) => {
    await tx.onlineOrder.update({
      where: { id: orderId },
      data: {
        status: updates.status ?? order.status,
        acceptanceState: updates.acceptanceState ?? order.acceptanceState,
        preparationState: updates.preparationState ?? order.preparationState,
        paymentState: updates.paymentState ?? order.paymentState,
        fulfillmentState: updates.fulfillmentState ?? order.fulfillmentState,
        acceptedAt: updates.acceptedAt ?? order.acceptedAt,
      },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId,
        eventType,
        fromState: order.status,
        toState: updates.status ?? order.status,
        source: "worker",
      },
    });
  });

  return true;
}
