"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import type { MenuProduct } from "@/types/menu";
import { SmartImage } from "@/components/ui/SmartImage";
import { QuantityControl } from "@/components/ui/QuantityControl";
import { useCartStore } from "@/store/cart-store";
import { formatMAD } from "@/lib/money";

export function ProductDetailClient({
  product,
  orderingEnabled = true,
}: {
  product: MenuProduct;
  orderingEnabled?: boolean;
}) {
  const addLine = useCartStore((state) => state.addLine);
  const defaultVariant =
    product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
  const [variantId, setVariantId] = useState(defaultVariant?.id ?? "");
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedVariant = product.variants.find((v) => v.id === variantId);
  const modifierTotal = useMemo(() => {
    let total = 0;
    for (const group of product.modifierGroups) {
      const selected = selectedModifiers[group.id] ?? [];
      for (const modifier of group.modifiers) {
        if (selected.includes(modifier.id)) total += modifier.price;
      }
    }
    return total;
  }, [product.modifierGroups, selectedModifiers]);

  const toggleModifier = (groupId: string, modifierId: string, max: number) => {
    setError(null);
    setSelectedModifiers((current) => {
      const selected = current[groupId] ?? [];
      if (selected.includes(modifierId)) {
        return { ...current, [groupId]: selected.filter((id) => id !== modifierId) };
      }
      if (selected.length >= max) {
        return current;
      }
      return { ...current, [groupId]: [...selected, modifierId] };
    });
  };

  const validateSelection = (): boolean => {
    for (const group of product.modifierGroups) {
      const count = (selectedModifiers[group.id] ?? []).length;
      if (count < group.minSelection || count > group.maxSelection) {
        const range =
          group.minSelection === group.maxSelection
            ? `${group.minSelection}`
            : `entre ${group.minSelection} et ${group.maxSelection}`;
        setError(`« ${group.name} » : sélectionnez ${range} option(s)`);
        return false;
      }
    }
    return true;
  };

  const handleAdd = () => {
    if (!selectedVariant) return;
    if (!orderingEnabled) {
      setError("Les commandes en ligne sont momentanément désactivées.");
      return;
    }
    if (!product.caisseAvailable) {
      setError("Ce produit est momentanément indisponible.");
      return;
    }
    if (!validateSelection()) return;
    const modifierIds = Object.values(selectedModifiers).flat();
    addLine({
      productId: product.id,
      productName: product.name,
      productImage: product.imageUrl,
      brandId: product.brandId,
      variantId: selectedVariant.id,
      variantName: selectedVariant.name,
      unitPrice: selectedVariant.price + modifierTotal,
      modifierIds,
      notes,
      quantity,
    });
    setError(null);
  };

  const unitPrice = (selectedVariant?.price ?? 0) + modifierTotal;

  return (
    <div className="page-width" style={{ paddingBottom: 80 }}>
      <Link href="/menu" className="store-nav" style={{ margin: "20px 0", fontSize: 13 }}>
        <ArrowLeft weight="bold" aria-hidden="true" /> Retour au menu
      </Link>

      <div className="checkout-layout">
        <div>
          <div className="product-card" style={{ border: 0, overflow: "hidden" }}>
            <div className="product-card-image" style={{ aspectRatio: "16/9" }}>
              <SmartImage src={product.imageUrl} alt={product.name} fill sizes="(max-width: 760px) 94vw, 640px" />
            </div>
          </div>

          <div style={{ marginTop: 26 }}>
            <h1 style={{ margin: "0 0 8px", fontSize: "clamp(28px, 4vw, 40px)", fontFamily: '"Archivo Black", sans-serif' }}>
              {product.name}
            </h1>
            <p style={{ color: "#a3aca6", lineHeight: 1.6, margin: "0 0 18px" }}>
              {product.description ?? "Sans description"}
            </p>
            {product.ingredients ? (
              <p style={{ color: "#a3aca6", fontSize: 13, margin: "0 0 18px" }}>
                <strong style={{ color: "#f7f9f7" }}>Ingrédients : </strong>
                {product.ingredients}
              </p>
            ) : null}

            <div className="option-group">
              <div className="option-group-label">
                Choisissez votre taille
              </div>
              <div className="option-list" role="group" aria-label="Taille">
                {product.variants.map((variant) => (
                  <button
                    type="button"
                    key={variant.id}
                    className="option-pill"
                    aria-pressed={variantId === variant.id}
                    onClick={() => setVariantId(variant.id)}
                  >
                    {variant.name} <small>{formatMAD(variant.price)}</small>
                  </button>
                ))}
              </div>
            </div>

            {product.modifierGroups.map((group) => (
              <div className="option-group" key={group.id}>
                <div className="option-group-label">
                  {group.name}
                  <small>
                    {group.required ? "obligatoire" : "optionnel"} ·{" "}
                    {group.minSelection === group.maxSelection
                      ? `${group.minSelection}`
                      : `${group.minSelection}–${group.maxSelection}`}{" "}
                    choix
                  </small>
                </div>
                <div className="option-list" role="group" aria-label={group.name}>
                  {group.modifiers.map((modifier) => {
                    const selected = (selectedModifiers[group.id] ?? []).includes(modifier.id);
                    return (
                      <button
                        type="button"
                        key={modifier.id}
                        className="option-pill"
                        aria-pressed={selected}
                        onClick={() => toggleModifier(group.id, modifier.id, group.maxSelection)}
                      >
                        {modifier.name}{" "}
                        {modifier.price > 0 ? <small>+{formatMAD(modifier.price)}</small> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="option-group">
              <div className="option-group-label">Instructions de préparation</div>
              <div className="field">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex. : sans oignons, bien cuit… (facultatif)"
                  maxLength={200}
                />
              </div>
            </div>

            {error ? (
              <p className="field-error" style={{ margin: "0 0 12px" }}>{error}</p>
            ) : null}
          </div>
        </div>

        <aside className="summary-card">
          <h3>Votre sélection</h3>
          <div className="summary-line">
            <span>{selectedVariant?.name}</span>
            <strong>{formatMAD(selectedVariant?.price ?? 0)}</strong>
          </div>
          {modifierTotal > 0 ? (
            <div className="summary-line">
              <span>Suppléments</span>
              <strong>{formatMAD(modifierTotal)}</strong>
            </div>
          ) : null}
          <div className="summary-line">
            <span>Quantité</span>
            <QuantityControl value={quantity} onChange={setQuantity} />
          </div>
          <div className="summary-divider" />
          <div className="summary-total">
            <span>Total</span>
            <span>{formatMAD(unitPrice * quantity)}</span>
          </div>
          {orderingEnabled ? (
            <button
              type="button"
              className="button"
              style={{ width: "100%", marginTop: 18 }}
              onClick={handleAdd}
              disabled={!product.caisseAvailable}
            >
              Ajouter au panier <ArrowRight weight="bold" aria-hidden="true" />
            </button>
          ) : (
            <p
              className="price-change-banner"
              style={{ marginTop: 18, fontSize: 13, lineHeight: 1.5 }}
            >
              Les commandes en ligne sont momentanément désactivées. Le menu reste
              consultable.
            </p>
          )}
          {!product.caisseAvailable ? (
            <p className="product-unavailable" style={{ marginTop: 10 }}>Produit indisponible</p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
