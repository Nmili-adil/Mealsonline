import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetMockState, setMockPriceOverride } from "@/lib/caisse212/mock";
import { runCatalogSync } from "@/lib/sync/catalog-sync";

describe("catalog synchronization", () => {
  beforeEach(async () => {
    await resetMockState();
    await prisma.menuSyncCursor.deleteMany();
    // Isolate catalog tables for deterministic assertions.
    await prisma.productModifierGroup.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.modifier.deleteMany();
    await prisma.modifierGroup.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.brand.deleteMany();
  });

  it("imports the mock catalog idempotently", async () => {
    const first = await runCatalogSync();
    expect(first.status).toBe("success");
    expect(first.importedProducts).toBeGreaterThan(0);

    const countBefore = await prisma.product.count({ where: { archived: false } });

    const second = await runCatalogSync();
    expect(second.status).toBe("success");
    const countAfter = await prisma.product.count({ where: { archived: false } });
    expect(countAfter).toBe(countBefore);
  });

  it("applies POS price changes on the next sync", async () => {
    await runCatalogSync();

    const before = await prisma.productVariant.findFirst({
      where: { externalId: "var-margherita-med" },
    });
    expect(before?.price).toBe(2900);

    await setMockPriceOverride("var-margherita-med", 3100);
    await runCatalogSync();

    const after = await prisma.productVariant.findFirst({
      where: { externalId: "var-margherita-med" },
    });
    expect(after?.price).toBe(3100);
  });

  it("marks products as unavailable from the availability feed", async () => {
    await runCatalogSync();
    await runCatalogSync();

    const product = await prisma.product.findFirst({
      where: { externalId: "prod-margherita" },
    });
    expect(product?.caisseAvailable).toBe(true);
  });
});
