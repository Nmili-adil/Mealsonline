import type { StorefrontProductDetail } from "@/lib/caisse212/storefront/types";
import type { MenuProduct } from "@/types/menu";

/**
 * Adapt a V206 product-detail response to the existing MenuProduct shape used
 * by the cart and ProductDetailClient. Storefront ids are numeric POS ids and
 * are kept as strings (the cart keys are strings; the checkout bridge maps
 * them back to the catalog mirror).
 */
export function storefrontDetailToMenuProduct(
  detail: StorefrontProductDetail,
): MenuProduct {
  return {
    id: String(detail.id),
    slug: String(detail.id),
    name: detail.name,
    description: detail.description ?? null,
    imageUrl: detail.imageUrl ?? null,
    ingredients: null,
    caisseAvailable: true,
    isFeatured: false,
    isPromoted: false,
    brandId: null,
    categoryId: null,
    variants: detail.variants.map((variant) => ({
      id: String(variant.id),
      name: variant.name,
      price: variant.price,
      isDefault: variant.isDefault ?? false,
    })),
    modifierGroups: detail.modifierGroups.map((group) => ({
      id: String(group.id),
      name: group.name,
      minSelection: group.minSelection,
      maxSelection: group.maxSelection,
      required: group.required,
      modifiers: group.modifiers.map((modifier) => ({
        id: String(modifier.id),
        name: modifier.name,
        price: modifier.price,
      })),
    })),
  };
}
