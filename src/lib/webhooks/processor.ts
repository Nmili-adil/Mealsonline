import "server-only";
import { prisma } from "@/lib/prisma";
import { eventEffect } from "@/lib/orders/transitions";
import type { WebhookEventPayload } from "@/lib/validation/webhook";

export type WebhookProcessingResult =
  | { status: "processed" }
  | { status: "duplicate" }
  | { status: "order_not_found" }
  | { status: "invalid_transition"; message: string };

/**
 * Webhook processing — fast, idempotent, deduplicated.
 * Heavy work stays out; we only persist the event and apply the transition.
 */
export async function processWebhookEvent(
  event: WebhookEventPayload,
): Promise<WebhookProcessingResult> {
  // Deduplicate by external event ID. Race-safe via unique constraint.
  try {
    await prisma.integrationInbox.create({
      data: {
        eventType: event.type,
        externalEventId: event.id,
        payload: JSON.stringify(event),
        status: "received",
      },
    });
  } catch {
    return { status: "duplicate" };
  }

  const order = await prisma.onlineOrder.findFirst({
    where: { externalOrderId: event.data.externalOrderId },
  });
  if (!order) {
    await prisma.integrationInbox.update({
      where: { externalEventId: event.id },
      data: { status: "failed" },
    });
    return { status: "order_not_found" };
  }

  const effect = eventEffect(event.type, order);
  if (effect.error) {
    await prisma.integrationInbox.update({
      where: { externalEventId: event.id },
      data: { status: "failed" },
    });
    await prisma.integrationError.create({
      data: {
        scope: "webhook",
        provider: "caisse212",
        operation: event.type,
        message: effect.error,
        details: event.id,
      },
    });
    return { status: "invalid_transition", message: effect.error };
  }

  const updates = effect.updates;
  await prisma.$transaction(async (tx) => {
    await tx.onlineOrder.update({
      where: { id: order.id },
      data: {
        status: updates.status ?? order.status,
        acceptanceState: updates.acceptanceState ?? order.acceptanceState,
        preparationState: updates.preparationState ?? order.preparationState,
        paymentState: updates.paymentState ?? order.paymentState,
        fulfillmentState: updates.fulfillmentState ?? order.fulfillmentState,
        acceptedAt: updates.acceptedAt ?? order.acceptedAt,
        posOrderId: event.data.posOrderId ?? order.posOrderId,
      },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId: order.id,
        eventType: event.type,
        fromState: order.status,
        toState: updates.status ?? order.status,
        payload: JSON.stringify({ reason: event.data.reason ?? null }),
        idempotencyKey: event.id,
        source: "webhook",
      },
    });
    await tx.integrationInbox.update({
      where: { externalEventId: event.id },
      data: { status: "processed", processedAt: new Date() },
    });
  });

  return { status: "processed" };
}
