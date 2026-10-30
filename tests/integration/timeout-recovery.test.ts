import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetMockState, setMockScenario } from "@/lib/caisse212/mock";
import { runCatalogSync } from "@/lib/sync/catalog-sync";
import { validateCartAgainstCatalog } from "@/lib/orders/validate";
import { createPendingOrder } from "@/lib/orders/create-order";
import { processOutboxBatch } from "@/lib/orders/outbox";

describe("ambiguous timeout recovery", () => {
  beforeEach(async () => {
    await resetMockState();
    await prisma.menuSyncCursor.deleteMany();
    await runCatalogSync();
  });

  it("reconciles an accepted order after an ambiguous submit timeout", async () => {
    await setMockScenario("ambiguous_timeout");

    const product = await prisma.product.findFirstOrThrow({
      where: { externalId: "prod-margherita" },
      include: { variants: { where: { archived: false }, orderBy: { sortOrder: "asc" } } },
    });

    const input = {
      brandId: null,
      items: [
        {
          productId: product.id,
          variantId: product.variants[0].id,
          quantity: 1,
          modifierIds: [],
        },
      ],
      fulfillmentType: "delivery" as const,
      customerName: "Test Timeout",
      phone: "+212612345678",
      deliveryAddress: "Hay Izdihar, Marrakech",
      paymentMethod: "cash_on_delivery" as const,
    };

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
    expect(order.acceptanceState).toBe("accepted");
    expect(order.posOrderId).toBeTruthy();

    const outbox = await prisma.integrationOutbox.findUniqueOrThrow({
      where: { idempotencyKey: order.externalOrderId! },
    });
    expect(outbox.status).toBe("succeeded");
  });
});
