"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash, ArrowRight } from "@phosphor-icons/react";
import { useCartStore, cartSubtotalMinor } from "@/store/cart-store";
import { QuantityControl } from "@/components/ui/QuantityControl";
import { formatMAD } from "@/lib/money";

export function CartPageClient() {
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const updateNotes = useCartStore((state) => state.updateNotes);
  const subtotal = cartSubtotalMinor(lines);

  if (lines.length === 0) {
    return (
      <div className="empty-state">
        <h3>Votre panier est vide</h3>
        <p>Parcourez le menu et ajoutez vos plats préférés.</p>
        <Link href="/menu" className="button button-compact" style={{ marginTop: 16 }}>
          Voir le menu
        </Link>
      </div>
    );
  }

  return (
    <div className="checkout-layout">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {lines.map((line) => (
          <div className="cart-line" key={line.lineId} style={{ gridTemplateColumns: "84px 1fr auto" }}>
            <Image
              src={line.productImage || "/images/brand-pizzahub.png"}
              alt={line.productName}
              width={84}
              height={84}
            />
            <div className="cart-line-info">
              <h4>{line.productName}</h4>
              <p>{line.variantName}</p>
              <div className="cart-line-foot">
                <QuantityControl value={line.quantity} onChange={(value) => setQuantity(line.lineId, value)} />
                <strong>{formatMAD(line.unitPrice * line.quantity)}</strong>
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <input
                  value={line.notes ?? ""}
                  onChange={(event) => updateNotes(line.lineId, event.target.value)}
                  placeholder="Instructions (facultatif)"
                  maxLength={200}
                  style={{ minHeight: 38, fontSize: 12 }}
                />
              </div>
            </div>
            <button
              type="button"
              className="cart-drawer-close"
              onClick={() => removeLine(line.lineId)}
              aria-label={`Retirer ${line.productName}`}
            >
              <Trash weight="bold" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <aside className="summary-card">
        <h3>Récapitulatif</h3>
        <div className="summary-line">
          <span>Sous-total</span>
          <strong>{formatMAD(subtotal)}</strong>
        </div>
        <div className="summary-divider" />
        <div className="summary-total">
          <span>Total estimé</span>
          <span>{formatMAD(subtotal)}</span>
        </div>
        <p style={{ margin: "10px 0 0", color: "#a3aca6", fontSize: 12 }}>
          Prix estimés — le montant final est validé au moment de la commande.
        </p>
        <Link href="/checkout" className="button" style={{ width: "100%", marginTop: 16 }}>
          Passer la commande <ArrowRight weight="bold" aria-hidden="true" />
        </Link>
        <Link href="/menu" className="admin-button admin-button-secondary" style={{ width: "100%", marginTop: 10, justifyContent: "center" }}>
          Continuer mes achats
        </Link>
      </aside>
    </div>
  );
}
