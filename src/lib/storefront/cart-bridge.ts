import "server-only";
import { loadStorefrontCatalog } from "@/lib/caisse212/storefront/catalog-source";
import { buildStorefrontIdMaps } from "@/lib/caisse212/storefront/ids";
import { getStorefrontMode, getStorefrontSlug } from "@/lib/caisse212/storefront/mode";
import { getPublicStorefrontConfig } from "@/lib/caisse212/storefront/public";
import type { CheckoutValidateInput } from "@/lib/validation/schemas";

/**
 * Bridge between the Storefront V206 public menu (numeric POS ids) and the
 * website's existing order pipeline (which validates prices against the
 * catalog mirror using database ids).
 *
 * Fixtures: numeric ids are the deterministic projection of the mirror's
 * external ids (see ids.ts), so the mapping is exact.
 *
 * Live: the bridge assumes the storefront numeric id equals the catalog
 * mirror's `externalId` (`String(id)`). That is the documented assumption to
 * confirm with Caisse212; an unmatched id fails with a clear message rather
 * than guessing a price or product.
 */

export type ResolvedCheckout<T extends CheckoutValidateInput = CheckoutValidateInput> =
  | { ok: true; input: T }
  | { ok: false; message: string };

function notAvailable<T extends CheckoutValidateInput>(): ResolvedCheckout<T> {
  return {
    ok: false,
    message:
      "Un article de votre panier n'est plus disponible dans le catalogue du restaurant. Actualisez le menu puis réessayez.",
  };
}

export async function resolveStorefrontCheckoutInput<T extends CheckoutValidateInput>(
  input: T,
): Promise<ResolvedCheckout<T>> {
  const mode = getStorefrontMode();
  if (mode === "off") return { ok: true, input };

  const catalog = await loadStorefrontCatalog();
  const maps = buildStorefrontIdMaps(catalog);

  const resolvedItems = [];
  for (const item of input.items) {
    const productNumeric = Number(item.productId);
    if (!Number.isInteger(productNumeric)) return notAvailable<T>();

    const product =
      mode === "fixtures"
        ? catalog.products.find(
            (row) => row.id === maps.products.dbIdByNumeric.get(productNumeric),
          )
        : catalog.products.find((row) => row.externalId === String(productNumeric));
    if (!product) return notAvailable<T>();
    if (!product.available) return notAvailable<T>();

    const variantNumeric = Number(item.variantId);
    const variant =
      mode === "fixtures"
        ? product.variants.find(
            (row) => row.id === maps.variants.dbIdByNumeric.get(variantNumeric),
          )
        : product.variants.find((row) => row.externalId === String(variantNumeric));
    if (!variant) return notAvailable<T>();

    const productModifierIds = new Set(
      product.modifierGroups.flatMap((group) => group.modifiers.map((modifier) => modifier.id)),
    );
    const resolvedModifierIds: string[] = [];
    for (const modifierId of item.modifierIds) {
      const modifierNumeric = Number(modifierId);
      const modifier =
        mode === "fixtures"
          ? product.modifierGroups
              .flatMap((group) => group.modifiers)
              .find(
                (row) => row.id === maps.modifiers.dbIdByNumeric.get(modifierNumeric),
              )
          : product.modifierGroups
              .flatMap((group) => group.modifiers)
              .find((row) => row.externalId === String(modifierNumeric));
      if (!modifier || !productModifierIds.has(modifier.id)) return notAvailable<T>();
      resolvedModifierIds.push(modifier.id);
    }

    resolvedItems.push({
      ...item,
      productId: product.id,
      variantId: variant.id,
      modifierIds: resolvedModifierIds,
    });
  }

  return {
    ok: true,
    input: { ...input, items: resolvedItems } as T,
  };
}

/**
 * Server-side orderingEnabled enforcement. When the storefront API is
 * enabled, both configuration and menu expose the flag; ordering must be
 * refused server-side, not only hidden in the UI.
 */
export async function storefrontOrderingAllowed(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  if (getStorefrontMode() === "off") return { ok: true };
  const config = await getPublicStorefrontConfig(getStorefrontSlug());
  if (!config) {
    return {
      ok: false,
      message: "Le site du restaurant est indisponible. La commande en ligne est fermée.",
    };
  }
  if (!config.orderingEnabled) {
    return {
      ok: false,
      message:
        "Les commandes en ligne sont momentanément désactivées. Vous pouvez consulter le menu.",
    };
  }
  return { ok: true };
}
