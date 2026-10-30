import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { resetMockState } from "@/lib/caisse212/mock";
import { runCatalogSync } from "@/lib/sync/catalog-sync";
import { validateCartAgainstCatalog } from "@/lib/orders/validate";
import { createPendingOrder } from "@/lib/orders/create-order";
import { processWebhookEvent } from "@/lib/webhooks/processor";
import type { WebhookEventPayload } from "@/lib/validation/webhook";

describe("webhook deduplication", () => {
  beforeEach(async () => {
    await resetMockState();
    await prisma.menuSyncCursor.deleteMany();
    await runCatalogSync();
  });

  it("applies an accepted event exactly once for duplicate deliveries", async () => {
    const product = await prisma.product.findFirstOrThrow({
      where: { externalId: "prod-margherita" },
      include: { variants: { where: { archived: false }, orderBy: { sortOrder: "asc" } } },
    });

    const input = {
      brandId: null,
      items: [
        { productId: product.id, variantId: product.variants[0].id, quantity: 1, modifierIds: [] },
      ],
      fulfillmentType: "pickup" as const,
      customerName: "Test Webhook",
      phone: "+212612345678",
      paymentMethod: "pay_at_pickup" as const,
    };
    const validation = await validateCartAgainstCatalog(input as never);
    if (!validation.ok) throw new Error("validation failed");
    const created = await createPendingOrder({
      ...input,
      approvedTotal: validation.total,
      approvePriceChange: false,
    } as never);
    if (!created.ok) throw new Error("create failed");

    const order = await prisma.onlineOrder.findUniqueOrThrow({ where: { id: created.orderId } });
    const event: WebhookEventPayload = {
      id: `evt-${randomUUID()}`,
      type: "order.accepted",
      timestamp: new Date().toISOString(),
      data: { externalOrderId: order.externalOrderId!, posOrderId: "POS-WEBHOOK-1" },
    };

    const first = await processWebhookEvent(event);
    const second = await processWebhookEvent(event);

    expect(first.status).toBe("processed");
    expect(second.status).toBe("duplicate");

    const events = await prisma.orderStatusEvent.count({
      where: { idempotencyKey: event.id },
    });
    expect(events).toBe(1);

    const updated = await prisma.onlineOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.acceptanceState).toBe("accepted");
    expect(updated.posOrderId).toBe("POS-WEBHOOK-1");
  });

  it("rejects invalid status transitions from webhooks", async () => {
    const product = await prisma.product.findFirstOrThrow({
      where: { externalId: "prod-margherita" },
      include: { variants: { where: { archived: false } } },
    });
    const input = {
      brandId: null,
      items: [
        { productId: product.id, variantId: product.variants[0].id, quantity: 1, modifierIds: [] },
      ],
      fulfillmentType: "pickup" as const,
      customerName: "Test Webhook 2",
      phone: "+212612345678",
      paymentMethod: "pay_at_pickup" as const,
    };
    const validation = await validateCartAgainstCatalog(input as never);
    if (!validation.ok) throw new Error("validation failed");
    const created = await createPendingOrder({
      ...input,
      approvedTotal: validation.total,
      approvePriceChange: false,
    } as never);
    if (!created.ok) throw new Error("create failed");

    const order = await prisma.onlineOrder.findUniqueOrThrow({ where: { id: created.orderId } });
    const event: WebhookEventPayload = {
      id: `evt-${randomUUID()}`,
      type: "order.rejected",
      timestamp: new Date().toISOString(),
      data: { externalOrderId: order.externalOrderId! },
    };
    const first = await processWebhookEvent(event);
    expect(first.status).toBe("processed");

    const secondEvent: WebhookEventPayload = {
      id: `evt-${randomUUID()}`,
      type: "order.accepted",
      timestamp: new Date().toISOString(),
      data: { externalOrderId: order.externalOrderId! },
    };
    const second = await processWebhookEvent(secondEvent);
    expect(second.status).toBe("invalid_transition");
  });
});
