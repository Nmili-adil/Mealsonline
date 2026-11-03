import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetMockState } from "@/lib/caisse212/mock";
import { runCatalogSync } from "@/lib/sync/catalog-sync";
import {
  ensureFixtureStorefront,
  getFixtureConfig,
  getFixtureMenu,
  resetStorefrontFixtures,
} from "@/lib/caisse212/storefront/fixtures";
import { storefrontAdmin } from "@/lib/caisse212/storefront/admin";
import { loadStorefrontCatalog } from "@/lib/caisse212/storefront/catalog-source";
import { buildStorefrontIdMaps } from "@/lib/caisse212/storefront/ids";
import { resolveStorefrontCheckoutInput } from "@/lib/storefront/cart-bridge";

const SLUG = "mealsonline";

beforeEach(async () => {
  await resetMockState();
  await prisma.menuSyncCursor.deleteMany();
  await runCatalogSync();
  await resetStorefrontFixtures();
});

describe("storefront fixtures (public contract)", () => {
  it("serves a configured storefront and its menu", async () => {
    const config = await getFixtureConfig(SLUG);
    expect(config).not.toBeNull();
    expect(config!.slug).toBe(SLUG);
    expect(config!.menuCode).toMatch(/^SF-\d+-mealsonline$/);
    expect(config!.orderingEnabled).toBe(true);
    expect(config!.data.theme?.primary).toBe("#00e83a");

    const menu = await getFixtureMenu(SLUG);
    expect(menu).not.toBeNull();
    expect(menu!.menuCode).toBe(config!.menuCode);
    expect(menu!.collections.length).toBeGreaterThan(0);
    const products = menu!.collections.flatMap((collection) => collection.products);
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((product) => product.price > 0)).toBe(true);
  });

  it("returns 404-equivalent null for an unknown or inactive storefront", async () => {
    expect(await getFixtureMenu("does-not-exist")).toBeNull();

    const seeded = await ensureFixtureStorefront();
    await storefrontAdmin.update(seeded.id, {
      slug: seeded.slug,
      name: seeded.name,
      businessId: seeded.businessId,
      allowedOrigins: seeded.allowedOrigins,
      active: false,
      data: seeded.data,
    });

    expect(await getFixtureMenu(SLUG)).toBeNull();
    expect(await getFixtureConfig(SLUG)).toBeNull();
    // The authenticated admin preview still works while inactive.
    const adminMenu = await storefrontAdmin.getMenu(seeded.id);
    expect(adminMenu.collections.length).toBeGreaterThan(0);
  });
});

describe("storefront admin fixtures (full replacement contract)", () => {
  it("lists, creates, updates and soft-deletes storefronts", async () => {
    const list = await storefrontAdmin.list();
    expect(list).toHaveLength(1);
    const seeded = list[0];
    expect(seeded.version).toBe(1);

    const created = await storefrontAdmin.create({
      slug: "second-site",
      name: "Second site",
      allowedOrigins: ["https://second.ma"],
      active: true,
      data: { collections: [] },
    });
    expect(created.id).not.toBe(seeded.id);
    expect(created.version).toBe(1);
    expect(created.publicUrl).toContain("/api/public/storefront/second-site");
    expect((await storefrontAdmin.list())).toHaveLength(2);

    const updated = await storefrontAdmin.update(created.id, {
      slug: "second-site",
      name: "Second site renamed",
      allowedOrigins: ["https://second.ma", "http://localhost:3000"],
      active: false,
      data: { theme: { primary: "#123456" }, customKey: true },
    });
    expect(updated.version).toBe(2);
    expect(updated.name).toBe("Second site renamed");
    expect(updated.data.customKey).toBe(true);

    await expect(
      storefrontAdmin.update(created.id, {
        slug: "second-site",
        name: "Second site",
        allowedOrigins: [],
        active: true,
        data: {},
        businessId: 999,
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      storefrontAdmin.create({
        slug: "second-site",
        name: "Duplicate slug",
        allowedOrigins: [],
        active: true,
        data: {},
      }),
    ).rejects.toMatchObject({ status: 400 });

    await storefrontAdmin.delete(created.id);
    expect((await storefrontAdmin.list())).toHaveLength(1);
    // The slug becomes available again after a soft delete.
    const recreated = await storefrontAdmin.create({
      slug: "second-site",
      name: "Second site again",
      allowedOrigins: [],
      active: true,
      data: {},
    });
    expect(recreated.id).not.toBe(created.id);
  });

  it("rejects unknown category/product ids in save and preview", async () => {
    const seeded = await ensureFixtureStorefront();

    await expect(
      storefrontAdmin.update(seeded.id, {
        slug: seeded.slug,
        name: seeded.name,
        businessId: seeded.businessId,
        allowedOrigins: seeded.allowedOrigins,
        active: true,
        data: { collections: [{ name: "Broken", productIds: [999_999] }] },
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      storefrontAdmin.previewMenu(seeded.id, {
        collections: [{ name: "Broken", categoryIds: [888_888] }],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("never allows price overrides", async () => {
    const seeded = await ensureFixtureStorefront();
    await expect(
      storefrontAdmin.update(seeded.id, {
        slug: seeded.slug,
        name: seeded.name,
        businessId: seeded.businessId,
        allowedOrigins: seeded.allowedOrigins,
        active: true,
        data: {
          productOverrides: {
            "1": { name: "Renamed", price: 1 } as Record<string, unknown>,
          },
        },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("per-storefront isolation", () => {
  it("hides/overrides products only for the edited storefront", async () => {
    const seeded = await ensureFixtureStorefront();
    const catalog = await loadStorefrontCatalog();
    const maps = buildStorefrontIdMaps(catalog);
    const margheritaNumeric = maps.products.numericByDbId.get(
      catalog.products.find((product) => product.externalId === "prod-margherita")!.id,
    )!;
    const pepperoniNumeric = maps.products.numericByDbId.get(
      catalog.products.find((product) => product.externalId === "prod-pepperoni")!.id,
    )!;

    await storefrontAdmin.update(seeded.id, {
      slug: seeded.slug,
      name: seeded.name,
      businessId: seeded.businessId,
      allowedOrigins: seeded.allowedOrigins,
      active: true,
      data: {
        hiddenProductIds: [margheritaNumeric],
        productOverrides: { [String(pepperoniNumeric)]: { name: "Pepperoni maison" } },
      },
    });

    const menu = await getFixtureMenu(SLUG);
    const allProducts = menu!.collections.flatMap((collection) => collection.products);
    expect(allProducts.some((product) => product.id === margheritaNumeric)).toBe(false);
    expect(
      allProducts.find((product) => product.id === pepperoniNumeric)?.name,
    ).toBe("Pepperoni maison");

    // A second storefront using categories as-is still shows Margherita.
    await storefrontAdmin.create({
      slug: "other-site",
      name: "Other site",
      allowedOrigins: [],
      active: true,
      data: {},
    });
    const otherMenu = await getFixtureMenu("other-site");
    const otherProducts = otherMenu!.collections.flatMap((collection) => collection.products);
    expect(otherProducts.some((product) => product.id === margheritaNumeric)).toBe(true);
  });
});

describe("checkout bridge (storefront ids → catalog mirror ids)", () => {
  it("maps numeric storefront product/variant ids to database ids", async () => {
    await ensureFixtureStorefront();
    const catalog = await loadStorefrontCatalog();
    const maps = buildStorefrontIdMaps(catalog);
    const margherita = catalog.products.find((product) => product.externalId === "prod-margherita")!;
    const productNumeric = maps.products.numericByDbId.get(margherita.id)!;
    const variantNumeric = maps.variants.numericByDbId.get(margherita.variants[0].id)!;

    const resolved = await resolveStorefrontCheckoutInput({
      items: [
        {
          productId: String(productNumeric),
          variantId: String(variantNumeric),
          quantity: 1,
          modifierIds: [],
        },
      ],
      fulfillmentType: "pickup",
      customerName: "Client Test",
      phone: "+212612345678",
      paymentMethod: "pay_at_pickup",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.input.items[0].productId).toBe(margherita.id);
    expect(resolved.input.items[0].variantId).toBe(margherita.variants[0].id);
  });

  it("refuses unknown storefront ids instead of guessing", async () => {
    const resolved = await resolveStorefrontCheckoutInput({
      items: [
        {
          productId: "999999999",
          variantId: "1",
          quantity: 1,
          modifierIds: [],
        },
      ],
      fulfillmentType: "pickup",
      customerName: "Client Test",
      phone: "+212612345678",
      paymentMethod: "pay_at_pickup",
    });
    expect(resolved.ok).toBe(false);
  });
});
