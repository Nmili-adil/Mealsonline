import { describe, expect, it } from "vitest";
import { checkoutSubmitSchema, checkoutValidateSchema, normalizePhone } from "@/lib/validation/schemas";

describe("phone normalization", () => {
  it("normalizes local Moroccan numbers to +212", () => {
    expect(normalizePhone("0612345678")).toBe("+212612345678");
    expect(normalizePhone("+212 6 12 34 56 78")).toBe("+212612345678");
    expect(normalizePhone("00212612345678")).toBe("+212612345678");
  });
});

describe("checkout validation", () => {
  const validBase = {
    items: [
      {
        productId: "product-1",
        variantId: "variant-1",
        quantity: 1,
        modifierIds: [],
      },
    ],
    fulfillmentType: "delivery",
    customerName: "Jean Dupont",
    phone: "+212612345678",
    deliveryAddress: "Hay Izdihar, Marrakech",
    paymentMethod: "cash_on_delivery",
  };

  it("accepts a valid payload", () => {
    const parsed = checkoutValidateSchema.safeParse(validBase);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.phone).toBe("+212612345678");
  });

  it("rejects an invalid phone", () => {
    const parsed = checkoutValidateSchema.safeParse({ ...validBase, phone: "12345" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a zero quantity", () => {
    const parsed = checkoutValidateSchema.safeParse({
      ...validBase,
      items: [{ ...validBase.items[0], quantity: 0 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts submit payload with approved total", () => {
    const parsed = checkoutSubmitSchema.safeParse({
      ...validBase,
      approvedTotal: 4900,
      approvePriceChange: true,
    });
    expect(parsed.success).toBe(true);
  });
});
