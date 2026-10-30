import "server-only";
import { prisma } from "@/lib/prisma";
import { getDefaultRestaurant } from "@/lib/site";
import { sumMinor, multiplyMinor } from "@/lib/money";
import type { CheckoutValidateInput } from "@/lib/validation/schemas";

export interface ValidatedModifier {
  modifierId: string;
  externalModifierId: string | null;
  groupName: string;
  name: string;
  unitPrice: number;
}

export interface ValidatedCartLine {
  productId: string;
  externalProductId: string | null;
  productName: string;
  variantId: string;
  externalVariantId: string | null;
  variantName: string;
  unitPrice: number;
  quantity: number;
  modifiers: ValidatedModifier[];
  notes?: string;
  lineTotal: number;
  externalModifierIds: string[];
  brandId: string | null;
}

export type CartValidationResult =
  | {
      ok: true;
      lines: ValidatedCartLine[];
      subtotal: number;
      deliveryFee: number;
      total: number;
      currency: string;
      brandId: string | null;
      clientTotal: number;
      priceChanged: boolean;
    }
  | {
      ok: false;
      code:
        | "empty_cart"
        | "product_not_found"
        | "product_unavailable"
        | "variant_not_found"
        | "modifier_not_found"
        | "modifier_constraint"
        | "mixed_brand"
        | "invalid_input";
      message: string;
    };

/**
 * Revalidate a browser cart against the authoritative website catalog mirror.
 * The browser never supplies prices — every price comes from the database.
 */
export async function validateCartAgainstCatalog(
  input: CheckoutValidateInput,
  clientTotal?: number,
): Promise<CartValidationResult> {
  if (input.items.length === 0) {
    return { ok: false, code: "empty_cart", message: "Votre panier est vide" };
  }

  const restaurant = await getDefaultRestaurant();

  // Load products with variants, images not needed, and modifier groups.
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, restaurantId: restaurant.id, archived: false },
    include: {
      brand: true,
      variants: { where: { archived: false } },
      modifierGroups: {
        include: { group: { include: { modifiers: { where: { archived: false } } } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const lines: ValidatedCartLine[] = [];
  let subtotal = 0;
  let firstBrandId: string | null = null;
  let mixedBrands = false;

  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      return { ok: false, code: "product_not_found", message: "Un produit n'existe plus" };
    }
    if (!product.websiteVisible) {
      return { ok: false, code: "product_not_found", message: `« ${product.name} » n'est plus disponible` };
    }
    if (!product.caisseAvailable) {
      return {
        ok: false,
        code: "product_unavailable",
        message: `« ${product.name} » est momentanément indisponible`,
      };
    }

    // Outlet compatibility: all products must belong to the same restaurant
    // (guaranteed by the query above). Different brands of the SAME
    // restaurant are compatible and can share one order. When the customer
    // explicitly scoped the order to a brand, every line must match it.
    if (input.brandId && product.brandId !== input.brandId) {
      return {
        ok: false,
        code: "mixed_brand",
        message: "Votre panier mélange plusieurs marques. Terminez une commande par marque.",
      };
    }
    if (firstBrandId === null) {
      firstBrandId = product.brandId;
    } else if (product.brandId !== firstBrandId) {
      mixedBrands = true;
    }

    const variant = product.variants.find((v) => v.id === item.variantId);
    if (!variant) {
      return {
        ok: false,
        code: "variant_not_found",
        message: `La variante sélectionnée pour « ${product.name} » n'existe plus`,
      };
    }

    // Modifier validation against the product's attached groups.
    const modifiers: ValidatedModifier[] = [];
    const externalModifierIds: string[] = [];
    const selectedCountByGroup = new Map<string, number>();

    for (const link of product.modifierGroups) {
      const group = link.group;
      const selected = group.modifiers.filter((mod) =>
        item.modifierIds.includes(mod.id),
      );
      selectedCountByGroup.set(group.id, selected.length);

      if (selected.length < group.minSelection || selected.length > group.maxSelection) {
        const range =
          group.minSelection === group.maxSelection
            ? `${group.minSelection}`
            : `entre ${group.minSelection} et ${group.maxSelection}`;
        return {
          ok: false,
          code: "modifier_constraint",
          message: `« ${group.name} » : sélectionnez ${range} option(s)`,
        };
      }

      for (const mod of selected) {
        modifiers.push({
          modifierId: mod.id,
          externalModifierId: mod.externalId,
          groupName: group.name,
          name: mod.name,
          unitPrice: mod.price,
        });
        if (mod.externalId) externalModifierIds.push(mod.externalId);
      }
    }

    // Reject modifier IDs that don't belong to any attached group.
    const knownModifierIds = product.modifierGroups.flatMap((link) =>
      link.group.modifiers.map((mod) => mod.id),
    );
    const unknown = item.modifierIds.filter((id) => !knownModifierIds.includes(id));
    if (unknown.length > 0) {
      return {
        ok: false,
        code: "modifier_not_found",
        message: "Une option sélectionnée n'existe plus pour ce produit",
      };
    }

    const lineTotal =
      multiplyMinor(variant.price, item.quantity) +
      sumMinor(modifiers.map((mod) => multiplyMinor(mod.unitPrice, item.quantity)));
    subtotal += lineTotal;

    lines.push({
      productId: product.id,
      externalProductId: product.externalId,
      productName: product.name,
      variantId: variant.id,
      externalVariantId: variant.externalId,
      variantName: variant.name,
      unitPrice: variant.price,
      quantity: item.quantity,
      modifiers,
      notes: item.notes,
      lineTotal,
      externalModifierIds,
      brandId: product.brandId,
    });
  }

  const deliveryFee = input.fulfillmentType === "delivery" ? restaurant.deliveryFee : 0;
  const total = subtotal + deliveryFee;
  const clientTotalMinor = clientTotal ?? total;
  const priceChanged = clientTotalMinor !== total;

  return {
    ok: true,
    lines,
    subtotal,
    deliveryFee,
    total,
    currency: restaurant.currency,
    brandId: mixedBrands ? null : firstBrandId,
    clientTotal: clientTotalMinor,
    priceChanged,
  };
}
