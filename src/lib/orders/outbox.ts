import "server-only";
import { prisma } from "@/lib/prisma";
import { Caisse212Error } from "@/lib/caisse212/types";
import {
  lookupOrderByExternalId,
  submitOrderToCaisse212,
} from "@/lib/caisse212/orders";
import type { SubmitOrderInput } from "@/lib/caisse212/types";
import { computeOrderStatus } from "./transitions";

/**
 * Transactional outbox processing (at-least-once delivery with idempotent
 * POS acceptance). The worker calls `processOutboxBatch` in a loop; the
 * checkout route only ever writes outbox rows inside the order transaction.
 */

const BASE_RETRY_SECONDS = 5;
const MAX_RETRY_SECONDS = 15 * 60;
const STALE_LOCK_MS = 2 * 60 * 1000;

export function nextRetryDelay(attempts: number): number {
  return Math.min(BASE_RETRY_SECONDS * 2 ** Math.max(0, attempts - 1), MAX_RETRY_SECONDS);
}

export async function claimOutboxBatch(limit = 10) {
  const now = new Date();
  const staleLockBefore = new Date(now.getTime() - STALE_LOCK_MS);
  // Reclaim rows stuck in "processing" after a worker crash as well as rows
  // that are due for (re)delivery.
  const candidates = await prisma.integrationOutbox.findMany({
    where: {
      attempts: { lt: 100 },
      OR: [
        {
          status: { in: ["pending", "failed"] },
          nextAttemptAt: { lte: now },
        },
        {
          status: "processing",
          lockedAt: { lt: staleLockBefore },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const claimed: string[] = [];
  for (const event of candidates) {
    const claimedRow = await prisma.integrationOutbox.updateMany({
      where: {
        id: event.id,
        OR: [
          { status: { in: ["pending", "failed"] } },
          { status: "processing", lockedAt: { lt: staleLockBefore } },
        ],
      },
      data: { status: "processing", lockedAt: now },
    });
    if (claimedRow.count === 1) claimed.push(event.id);
  }
  return claimed;
}

export async function processOutboxEvent(eventId: string): Promise<void> {
  const event = await prisma.integrationOutbox.findUnique({ where: { id: eventId } });
  if (!event || event.status === "succeeded" || event.status === "expired") return;

  let input: SubmitOrderInput;
  try {
    input = JSON.parse(event.payload) as SubmitOrderInput;
  } catch {
    await prisma.integrationOutbox.update({
      where: { id: event.id },
      data: { status: "failed", lastError: "Payload invalide", attempts: { increment: 1 } },
    });
    return;
  }

  const order = await prisma.onlineOrder.findFirst({
    where: { externalOrderId: event.idempotencyKey },
  });
  if (!order) {
    await prisma.integrationOutbox.update({
      where: { id: event.id },
      data: { status: "failed", lastError: "Commande introuvable", attempts: { increment: 1 } },
    });
    return;
  }

  try {
    const result = await submitOrderToCaisse212(input);
    if (result.accepted) {
      await applyAccepted(event, order.id, result.posOrderId ?? null, result.authoritativeTotal ?? order.total);
      return;
    }
    // POS explicitly rejected the order.
    await applyRejected(event, order.id, result.rejectionReason ?? "Commande refusée");
    return;
  } catch (error) {
    if (error instanceof Caisse212Error && error.code === "timeout") {
      // Ambiguous timeout: reconcile by external ID before any retry.
      const existing = await lookupOrderByExternalId(event.idempotencyKey);
      if (existing && existing.acceptance === "accepted") {
        await applyAccepted(event, order.id, existing.posOrderId ?? null, order.total);
        return;
      }
    }

    const isRetryable =
      error instanceof Caisse212Error &&
      (error.retryable || error.code === "timeout" || error.code === "unavailable");

    const attempts = event.attempts + 1;
    const acceptanceDeadline = order.acceptanceDeadlineAt;

    if (!isRetryable) {
      await prisma.integrationOutbox.update({
        where: { id: event.id },
        data: {
          status: "failed",
          lastError: error instanceof Error ? error.message : "Erreur inconnue",
          attempts,
        },
      });
      await markOrderFailed(order.id, error instanceof Error ? error.message : "Erreur d'intégration");
      return;
    }

    // Acceptance deadline: final lookup before expiring the order.
    if (acceptanceDeadline && acceptanceDeadline.getTime() < Date.now()) {
      const existing = await lookupOrderByExternalId(event.idempotencyKey);
      if (existing && existing.acceptance === "accepted") {
        await applyAccepted(event, order.id, existing.posOrderId ?? null, order.total);
        return;
      }
      await applyExpired(event, order.id);
      return;
    }

    if (attempts >= event.maxAttempts) {
      await prisma.integrationOutbox.update({
        where: { id: event.id },
        data: {
          status: "failed",
          lastError: error instanceof Error ? error.message : "Erreur inconnue",
          attempts,
        },
      });
      await markOrderFailed(order.id, "Impossible de joindre Caisse212 après plusieurs tentatives");
      return;
    }

    const delay = nextRetryDelay(attempts);
    await prisma.integrationOutbox.update({
      where: { id: event.id },
      data: {
        status: "failed",
        lastError: error instanceof Error ? error.message : "Erreur inconnue",
        attempts,
        nextAttemptAt: new Date(Date.now() + delay * 1000),
      },
    });
  }
}

async function applyAccepted(
  event: { id: string },
  orderId: string,
  posOrderId: string | null,
  authoritativeTotal: number,
): Promise<void> {
  const order = await prisma.onlineOrder.findUniqueOrThrow({ where: { id: orderId } });
  const status = computeOrderStatus("accepted", order.preparationState, order.paymentState, order.fulfillmentState);
  await prisma.$transaction(async (tx) => {
    await tx.onlineOrder.update({
      where: { id: orderId },
      data: {
        posOrderId: posOrderId ?? order.posOrderId,
        status,
        acceptanceState: "accepted",
        // POS-authoritative items total + website delivery fee.
        total: authoritativeTotal + order.deliveryFee,
        amountsAuthorized: true,
        acceptedAt: order.acceptedAt ?? new Date(),
        submittedAt: order.submittedAt ?? new Date(),
      },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId,
        eventType: "order.accepted",
        fromState: "pending",
        toState: "accepted",
        source: "worker",
      },
    });
    await tx.integrationOutbox.update({
      where: { id: event.id },
      data: { status: "succeeded", processedAt: new Date(), attempts: { increment: 1 } },
    });
  });
}

async function applyRejected(
  event: { id: string },
  orderId: string,
  reason: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.onlineOrder.update({
      where: { id: orderId },
      data: {
        status: "rejected",
        acceptanceState: "rejected",
        fulfillmentState: "cancelled",
      },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId,
        eventType: "order.rejected",
        fromState: "pending",
        toState: "rejected",
        payload: JSON.stringify({ reason }),
        source: "worker",
      },
    });
    await tx.integrationOutbox.update({
      where: { id: event.id },
      data: { status: "succeeded", processedAt: new Date(), attempts: { increment: 1 } },
    });
  });
}

async function applyExpired(event: { id: string }, orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.onlineOrder.update({
      where: { id: orderId },
      data: { status: "expired", acceptanceState: "expired" },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId,
        eventType: "order.expired",
        fromState: "pending",
        toState: "expired",
        source: "worker",
      },
    });
    await tx.integrationOutbox.update({
      where: { id: event.id },
      data: { status: "expired", processedAt: new Date(), attempts: { increment: 1 } },
    });
  });
}

async function markOrderFailed(orderId: string, reason: string): Promise<void> {
  const order = await prisma.onlineOrder.findUnique({ where: { id: orderId } });
  if (!order) return;
  await prisma.onlineOrder.update({
    where: { id: orderId },
    data: { status: "failed" },
  });
  await prisma.orderStatusEvent.create({
    data: {
      orderId,
      eventType: "order.failed",
      fromState: order.status,
      toState: "failed",
      payload: JSON.stringify({ reason }),
      source: "worker",
    },
  });
}

export async function processOutboxBatch(limit = 10): Promise<number> {
  const ids = await claimOutboxBatch(limit);
  for (const id of ids) {
    await processOutboxEvent(id);
  }
  return ids.length;
}
