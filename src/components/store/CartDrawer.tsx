"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Trash, X } from "@phosphor-icons/react";
import { useCartStore, cartSubtotalMinor } from "@/store/cart-store";
import { formatMAD } from "@/lib/money";

export function CartDrawer() {
  const lines = useCartStore((state) => state.lines);
  const isOpen = useCartStore((state) => state.isDrawerOpen);
  const closeDrawer = useCartStore((state) => state.closeDrawer);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const subtotal = cartSubtotalMinor(lines);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            className="cart-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
          />
          <motion.aside
            className="cart-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            aria-label="Panier"
          >
            <div className="cart-drawer-head">
              <h2>Votre panier</h2>
              <button type="button" className="cart-drawer-close" onClick={closeDrawer} aria-label="Fermer le panier">
                <X weight="bold" aria-hidden="true" />
              </button>
            </div>

            <div className="cart-drawer-lines">
              {lines.length === 0 ? (
                <div className="empty-state">
                  <h3>Panier vide</h3>
                  <p>Parcourez le menu et ajoutez vos plats préférés.</p>
                  <Link href="/menu" onClick={closeDrawer} className="button button-compact">
                    Voir le menu
                  </Link>
                </div>
              ) : (
                lines.map((line) => (
                  <div className="cart-line" key={line.lineId}>
                    <Image
                      src={line.productImage || "/images/brand-pizzahub.png"}
                      alt={line.productName}
                      width={64}
                      height={64}
                    />
                    <div className="cart-line-info">
                      <h4>{line.productName}</h4>
                      <p>{line.variantName}</p>
                      <div className="cart-line-foot">
                        <div className="qty-control">
                          <button
                            type="button"
                            onClick={() => setQuantity(line.lineId, line.quantity - 1)}
                            aria-label="Diminuer la quantité"
                          >
                            <Minus weight="bold" />
                          </button>
                          <span>{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setQuantity(line.lineId, line.quantity + 1)}
                            aria-label="Augmenter la quantité"
                          >
                            <Plus weight="bold" />
                          </button>
                        </div>
                        <strong>{formatMAD(line.unitPrice * line.quantity)}</strong>
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
                ))
              )}
            </div>

            {lines.length > 0 ? (
              <div className="cart-drawer-foot">
                <div className="cart-drawer-total">
                  <span>Sous-total</span>
                  <span>{formatMAD(subtotal)}</span>
                </div>
                <p style={{ margin: 0, color: "#a3aca6", fontSize: 12 }}>
                  Prix estimés — le montant final est validé au moment du paiement.
                </p>
                <Link href="/cart" onClick={closeDrawer} className="button" style={{ width: "100%" }}>
                  Voir le panier
                </Link>
              </div>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
