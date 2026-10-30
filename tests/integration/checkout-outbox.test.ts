import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  resetMockState,
  setMockScenario,
  setMockUnavailableProducts,
} from "@/lib/caisse212/mock";
import { runCatalogSync } from "@/lib/sync/catalog-sync";
import { validateCartAgainstCatalog } from "@/lib/orders/validate";
import { createPendingOrder } from "@/lib/orders/create-order";
import { processOutboxBatch } from "@/lib/orders/outbox";
import { submitOrderToCaisse212 } from "@/lib/caisse212/orders";

async function cartInput(overrides: Record<string, unknown> = {}) {
  const product = await prisma.product.findFirstOrThrow({
    where: { externalId: "prod-margherita" },
    include: {
      variants: { where: { archived: false }, orderBy: { sortOrder: "asc" } },
    },
  });
  return {
    brandId: null,
    items: [
      {
        productId: product.id,
        variantId: product.variants[0].id,
        quantity: 1,
        modifierIds: [],
        notes: undefined,
      },
    ],
    fulfillmentType: "delivery" as const,
    customerName: "Test Client",
    phone: "+212612345678",
    deliveryAddress: "Hay Izdihar, Marrakech",
    paymentMethod: "cash_on_delivery" as const,
    ...overrides,
  };
}

describe("checkout and outbox", () => {
  beforeEach(async () => {
    await resetMockState();
    await prisma.menuSyncCursor.deleteMany();
    await runCatalogSync();
  });

  it("rejects checkout when the POS price changed and the client total is stale", async () => {
    const input = await cartInput();
    const result = await createPendingOrder({
      ...input,
      approvedTotal: 1, // stale/wrong
      approvePriceChange: false,
    } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("price_changed");
      expect(result.requiresApproval).toBe(true);
    }
  });

  it("rejects checkout when a product is unavailable", async () => {
    await setMockUnavailableProducts(["prod-margherita"]);
    await runCatalogSync(); // apply the availability feed to the website mirror
    const input = await cartInput();
    const validation = await validateCartAgainstCatalog(input as never);
    expect(validation.ok).toBe(false);
    if (!validation.ok) expect(validation.code).toBe("product_unavailable");
  });

  it("creates a pending order and the outbox worker accepts it", async () => {
    const input = await cartInput();
    const validation = await validateCartAgainstCatalog(input as never);
    if (!validation.ok) throw new Error("validation failed");

    const created = await createPendingOrder({
      ...input,
      approvedTotal: validation.total,
      approvePriceChange: false,
    } as never);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("create failed");

    const orderBefore = await prisma.onlineOrder.findUniqueOrThrow({
      where: { id: created.orderId },
    });
    expect(orderBefore.status).toBe("pending_submission");

    await processOutboxBatch(10);

    const orderAfter = await prisma.onlineOrder.findUniqueOrThrow({
      where: { id: created.orderId },
    });
    expect(orderAfter.acceptanceState).toBe("accepted");
    expect(orderAfter.posOrderId).toBeTruthy();
    expect(orderAfter.total).toBe(validation.total);
  });

  it("submits the same external order idempotently to the POS (one logical POS order)", async () => {
    const input = await cartInput();
    const validation = await validateCartAgainstCatalog(input as never);
    if (!validation.ok) throw new Error("validation failed");

    const created = await createPendingOrder({
      ...input,
      approvedTotal: validation.total,
      approvePriceChange: false,
    } as never);
    if (!created.ok) throw new Error("create failed");

    const order = await prisma.onlineOrder.findUniqueOrThrow({
      where: { id: created.orderId },
    });
    const outbox = await prisma.integrationOutbox.findUniqueOrThrow({
      where: { idempotencyKey: order.externalOrderId! },
    });
    const payload = JSON.parse(outbox.payload) as Parameters<typeof submitOrderToCaisse212>[0];

    const first = await submitOrderToCaisse212(payload);
    const second = await submitOrderToCaisse212(payload);

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(true);
    expect(second.posOrderId).toBe(first.posOrderId);
  });

  it("never produces a false confirmation when the POS is offline", async () => {
    await setMockScenario("pos_offline");
    const input = await cartInput();
    const validation = await validateCartAgainstCatalog(input as never);
    if (!validation.ok) throw new Error("validation failed");

    const created = await createPendingOrder({
      ...input,
      approvedTotal: validation.total,
      approvePriceChange: false,
    } as never);
    if (!created.ok) throw new Error("create failed");

    await processOutboxBatch(10);

    const order = await prisma.onlineOrder.findUniqueOrThrow({
      where: { id: created.orderId },
    });
    expect(order.status).not.toBe("accepted");
    const outbox = await prisma.integrationOutbox.findUniqueOrThrow({
      where: { idempotencyKey: order.externalOrderId! },
    });
    expect(outbox.status).not.toBe("succeeded");
  });
});
