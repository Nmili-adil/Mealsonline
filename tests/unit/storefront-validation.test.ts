import { describe, expect, it } from "vitest";
import {
  isValidOrigin,
  isValidStorefrontSlug,
  slugifyStorefrontName,
  validateStorefrontPayload,
  updateStorefrontData,
  omitEmptyKeys,
  STOREFRONT_DATA_MAX_BYTES,
} from "@/lib/storefront/validation";
import type { StorefrontAdminPayload } from "@/lib/caisse212/storefront/types";

function payload(overrides: Partial<StorefrontAdminPayload> = {}): StorefrontAdminPayload {
  return {
    slug: "chez-ali",
    name: "Chez Ali — site principal",
    allowedOrigins: ["https://chezali.ma", "http://localhost:3000"],
    active: true,
    data: {},
    ...overrides,
  };
}

const ids = {
  categoryIds: new Set([10, 20]),
  productIds: new Set([100, 200, 300]),
};

describe("storefront slug", () => {
  it("slugifies names safely", () => {
    expect(slugifyStorefrontName("Chez Ali — Site Principal!")).toBe("chez-ali-site-principal");
    expect(slugifyStorefrontName("Pizzeria Émile")).toBe("pizzeria-emile");
    expect(slugifyStorefrontName("---hello---")).toBe("hello");
  });

  it("validates slug rules", () => {
    expect(isValidStorefrontSlug("chez-ali")).toBe(true);
    expect(isValidStorefrontSlug("ab")).toBe(false);
    expect(isValidStorefrontSlug("-chez")).toBe(false);
    expect(isValidStorefrontSlug("chez-")).toBe(false);
    expect(isValidStorefrontSlug("Chez Ali")).toBe(false);
  });
});

describe("origins", () => {
  it("accepts exact origins and *", () => {
    expect(isValidOrigin("*")).toBe(true);
    expect(isValidOrigin("https://chezali.ma")).toBe(true);
    expect(isValidOrigin("http://localhost:5173")).toBe(true);
  });

  it("rejects paths and other schemes", () => {
    expect(isValidOrigin("https://chezali.ma/menu")).toBe(false);
    expect(isValidOrigin("https://chezali.ma?a=1")).toBe(false);
    expect(isValidOrigin("ftp://chezali.ma")).toBe(false);
    expect(isValidOrigin("chezali.ma")).toBe(false);
  });

  it("rejects wildcard mixed with concrete origins", () => {
    const result = validateStorefrontPayload(
      payload({ allowedOrigins: ["*", "https://chezali.ma"] }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects more than 20 origins", () => {
    const result = validateStorefrontPayload(
      payload({ allowedOrigins: Array(21).fill("https://a.ma") }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("payload validation", () => {
  it("accepts a valid payload", () => {
    expect(validateStorefrontPayload(payload(), ids).ok).toBe(true);
  });

  it("rejects missing name and bad slug", () => {
    expect(validateStorefrontPayload(payload({ name: "  " }), ids).ok).toBe(false);
    expect(validateStorefrontPayload(payload({ slug: "Chez Ali" }), ids).ok).toBe(false);
  });

  it("rejects data above 256 KB", () => {
    const result = validateStorefrontPayload(
      payload({ data: { blob: "x".repeat(STOREFRONT_DATA_MAX_BYTES + 10) } }),
      ids,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("256");
  });

  it("rejects a section without a name", () => {
    const result = validateStorefrontPayload(
      payload({ data: { collections: [{ key: "food", name: "  ", categoryIds: [10] }] } }),
      ids,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown category and product ids, naming them", () => {
    const category = validateStorefrontPayload(
      payload({ data: { collections: [{ name: "Food", categoryIds: [999] }] } }),
      ids,
    );
    expect(category.ok).toBe(false);
    expect(category.message).toContain("999");

    const product = validateStorefrontPayload(
      payload({ data: { collections: [{ name: "Food", productIds: [777] }] } }),
      ids,
    );
    expect(product.ok).toBe(false);
    expect(product.message).toContain("777");

    const hidden = validateStorefrontPayload(
      payload({ data: { hiddenProductIds: [888] } }),
      ids,
    );
    expect(hidden.ok).toBe(false);
    expect(hidden.message).toContain("888");

    const override = validateStorefrontPayload(
      payload({ data: { productOverrides: { "999": { name: "X" } } } }),
      ids,
    );
    expect(override.ok).toBe(false);
    expect(override.message).toContain("999");
  });

  it("never allows a price override", () => {
    const result = validateStorefrontPayload(
      payload({
        data: {
          productOverrides: {
            "100": { name: "Renamed", price: 1 } as Record<string, unknown>,
          },
        },
      }),
      ids,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("prix");
  });

  it("accepts unknown keys and collection attributes", () => {
    const result = validateStorefrontPayload(
      payload({
        data: {
          customLandingSection: { enabled: true },
          collections: [
            {
              key: "food",
              name: "Food",
              categoryIds: [10],
              productIds: [100],
              badge: "hot",
              layout: "grid",
            },
          ],
        },
      }),
      ids,
    );
    expect(result.ok).toBe(true);
  });
});

describe("data helpers", () => {
  it("preserves unknown keys and never mutates the previous object", () => {
    const data = { theme: { primary: "#111111" }, custom: { deep: true } };
    const next = updateStorefrontData(data, (draft) => {
      draft.theme = { ...(draft.theme ?? {}), primary: "#00e83a" };
    });
    expect(next.theme?.primary).toBe("#00e83a");
    expect(next.custom).toEqual({ deep: true });
    expect(data.theme.primary).toBe("#111111");
  });

  it("drops empty keys only", () => {
    expect(omitEmptyKeys({ a: "", b: null, c: undefined, d: "x", e: 0 })).toEqual({
      d: "x",
      e: 0,
    });
  });
});
