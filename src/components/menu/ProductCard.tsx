"use client";

import { ArrowRight } from "@phosphor-icons/react";
import type { MenuProduct } from "@/types/menu";
import { SmartImage } from "@/components/ui/SmartImage";
import { useCartStore } from "@/store/cart-store";
import { formatMAD } from "@/lib/money";

function canAddDirectly(product: MenuProduct): boolean {
  return (
    product.variants.length === 1 &&
    product.modifierGroups.every((group) => group.minSelection === 0)
  );
}

export function ProductCard({
  product,
  onOpen,
}: {
  product: MenuProduct;
  onOpen: (slug: string) => void;
}) {
  const addLine = useCartStore((state) => state.addLine);
  const defaultVariant =
    product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
  const minPrice = Math.min(...product.variants.map((v) => v.price));

  const handleAdd = () => {
    if (canAddDirectly(product) && defaultVariant) {
      addLine({
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrl,
        brandId: product.brandId,
        variantId: defaultVariant.id,
        variantName: defaultVariant.name,
        unitPrice: defaultVariant.price,
        modifierIds: [],
        notes: "",
      });
    } else {
      onOpen(product.slug);
    }
  };

  return (
    <article className="product-card">
      <button
        type="button"
        className="product-card-image"
        onClick={() => onOpen(product.slug)}
        aria-label={`Voir ${product.name}`}
        style={{ border: 0, padding: 0, cursor: "pointer" }}
      >
        <SmartImage src={product.imageUrl} alt={product.name} fill sizes="(max-width: 760px) 90vw, 320px" />
      </button>
      <div className="product-card-body">
        <h3>{product.name}</h3>
        <p>{product.description ?? "Sans description"}</p>
        <div className="product-card-foot">
          {product.caisseAvailable ? (
            <>
              <span className="product-price">
                {product.variants.length > 1 ? `dès ${formatMAD(minPrice)}` : formatMAD(minPrice)}
              </span>
              <button type="button" className="product-add" onClick={handleAdd}>
                {canAddDirectly(product) ? "Ajouter" : "Personnaliser"}
                <ArrowRight weight="bold" aria-hidden="true" />
              </button>
            </>
          ) : (
            <span className="product-unavailable">Indisponible</span>
          )}
        </div>
      </div>
    </article>
  );
}
