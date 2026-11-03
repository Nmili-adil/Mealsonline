import { describe, expect, it } from "vitest";
import { buildStorefrontIdMaps } from "@/lib/caisse212/storefront/ids";
import {
  buildStorefrontMenu,
  buildStorefrontProductDetail,
} from "@/lib/caisse212/storefront/menu-builder";
import type {
  CatalogProductRow,
  StorefrontCatalog,
  StorefrontFixtureRecord,
} from "@/lib/caisse212/storefront/types";

function product(
  id: string,
  name: string,
  categoryId: string,
  price: number,
  overrides: Partial<CatalogProductRow> = {},
): CatalogProductRow {
  return {
    id,
    externalId: `ext-${id}`,
    categoryId,
    name,
    description: `${name} description`,
    imageUrl: null,
    sortOrder: 0,
    available: true,
    variants: [
      {
        id: `v-${id}`,
        externalId: `ext-v-${id}`,
        name: "Standard",
        price,
        isDefault: true,
        sortOrder: 0,
      },
    ],
    modifierGroups: [],
    ...overrides,
  };
}

const catalog: StorefrontCatalog = {
  currency: "MAD",
  categories: [
    { id: "c1", externalId: "ext-c1", name: "Pizzas", description: null, imageUrl: null, sortOrder: 1 },
    { id: "c2", externalId: "ext-c2", name: "Boissons", description: null, imageUrl: null, sortOrder: 2 },
  ],
  products: [
    product("p1", "Margherita", "c1", 2900),
    product("p2", "Pepperoni", "c1", 3200),
    product("p3", "Cola", "c2", 1500),
    product("p4", "Hidden Pizza", "c1", 9900),
    product("p5", "Off-menu Pizza", "c1", 4400, { available: false }),
  ],
};

const maps = buildStorefrontIdMaps(catalog);
const c1 = maps.categories.numericByDbId.get("c1")!;
const c2 = maps.categories.numericByDbId.get("c2")!;
const p1 = maps.products.numericByDbId.get("p1")!;
const p2 = maps.products.numericByDbId.get("p2")!;
const p3 = maps.products.numericByDbId.get("p3")!;
const p4 = maps.products.numericByDbId.get("p4")!;

function storefront(data: StorefrontFixtureRecord["data"]): StorefrontFixtureRecord {
  return {
    id: 7,
    slug: "demo",
    name: "Demo",
    businessId: 1,
    allowedOrigins: [],
    active: true,
    version: 3,
    data,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("storefront menu semantics", () => {
  it("uses real categories as sections when collections is absent", () => {
    const menu = buildStorefrontMenu({ storefront: storefront({}), catalog });
    expect(menu.menuCode).toBe("SF-7-demo");
    expect(menu.version).toBe(3);
    expect(menu.collections.map((section) => section.name)).toEqual(["Pizzas", "Boissons"]);
    expect(menu.collections[0].categoryId).toBe(c1);
    // Available products are all included; p5 is off-sale and must not appear.
    expect(menu.collections[0].products.map((item) => item.id)).toEqual([p4, p1, p2]);
  });

  it("returns no sections when collections is an empty array", () => {
    const menu = buildStorefrontMenu({ storefront: storefront({ collections: [] }), catalog });
    expect(menu.collections).toEqual([]);
  });

  it("builds custom collections: categories first, then explicit products, deduped", () => {
    const menu = buildStorefrontMenu({
      storefront: storefront({
        collections: [
          {
            key: "food",
            name: "Food",
            categoryIds: [c1],
            productIds: [p1, p3],
            badge: "hot",
            layout: "grid",
          },
        ],
      }),
      catalog,
    });
    expect(menu.collections).toHaveLength(1);
    const food = menu.collections[0];
    expect(food.key).toBe("food");
    expect(food.categoryId).toBeNull();
    expect(food.products.map((item) => item.id)).toEqual([p4, p1, p2, p3]);
    expect(food.attributes).toEqual({ badge: "hot", layout: "grid" });
  });

  it("drops hidden products and omits empty sections", () => {
    const menu = buildStorefrontMenu({
      storefront: storefront({
        collections: [
          { key: "pizzas", name: "Pizzas", categoryIds: [c1] },
          { key: "empty", name: "Empty", productIds: [p4] },
        ],
        hiddenProductIds: [p4, p1],
      }),
      catalog,
    });
    expect(menu.collections.map((section) => section.key)).toEqual(["pizzas"]);
    expect(menu.collections[0].products.map((item) => item.id)).toEqual([p2]);
  });

  it("applies display overrides but never prices", () => {
    const menu = buildStorefrontMenu({
      storefront: storefront({
        collections: [{ key: "drinks", name: "Drinks", categoryIds: [c2] }],
        productOverrides: {
          [String(p3)]: { name: "Cola glacé", description: "Bien frais", imageUrl: "https://x/y.jpg" },
        },
      }),
      catalog,
    });
    const cola = menu.collections[0].products[0];
    expect(cola.name).toBe("Cola glacé");
    expect(cola.description).toBe("Bien frais");
    expect(cola.imageUrl).toBe("https://x/y.jpg");
    expect(cola.price).toBe(1500);
  });

  it("passes orderingEnabled through", () => {
    const menu = buildStorefrontMenu({
      storefront: storefront({}),
      catalog,
      orderingEnabled: false,
    });
    expect(menu.orderingEnabled).toBe(false);
  });
});

describe("storefront product detail", () => {
  it("maps variants and modifier groups to numeric ids", () => {
    const detail = buildStorefrontProductDetail({
      storefront: storefront({}),
      catalog: {
        ...catalog,
        products: [
          {
            ...catalog.products[0],
            variants: [
              {
                id: "v-small",
                externalId: "ext-small",
                name: "Medium",
                price: 2900,
                isDefault: true,
                sortOrder: 1,
              },
              {
                id: "v-large",
                externalId: "ext-large",
                name: "Large",
                price: 4900,
                isDefault: false,
                sortOrder: 2,
              },
            ],
            modifierGroups: [
              {
                id: "g1",
                externalId: "ext-g1",
                name: "Extras",
                minSelection: 0,
                maxSelection: 2,
                required: false,
                sortOrder: 0,
                modifiers: [
                  {
                    id: "m1",
                    externalId: "ext-m1",
                    name: "Cheese",
                    price: 800,
                    sortOrder: 0,
                  },
                ],
              },
            ],
          },
        ],
      },
      productId: p1,
    });
    expect(detail).not.toBeNull();
    expect(detail!.variants).toHaveLength(2);
    expect(detail!.variants[0].id).toBeTypeOf("number");
    expect(detail!.modifierGroups[0].modifiers[0].name).toBe("Cheese");
  });

  it("returns null for hidden/unavailable/unknown products", () => {
    expect(
      buildStorefrontProductDetail({ storefront: storefront({}), catalog, productId: 999999 }),
    ).toBeNull();
    const offMenuNumeric = maps.products.numericByDbId.get("p5")!;
    expect(
      buildStorefrontProductDetail({
        storefront: storefront({}),
        catalog,
        productId: offMenuNumeric,
      }),
    ).toBeNull();
  });
});

describe("stable numeric ids", () => {
  it("is deterministic and collision-free for the same catalog", () => {
    const again = buildStorefrontIdMaps(catalog);
    expect(again.products.numericByDbId.get("p1")).toBe(p1);
    expect(new Set(again.products.dbIdByNumeric.keys()).size).toBe(catalog.products.length);
  });
});
