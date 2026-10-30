"use client";

import { ShoppingCartSimple } from "@phosphor-icons/react";
import { useCartStore, cartCount } from "@/store/cart-store";

export function CartButton() {
  const lines = useCartStore((state) => state.lines);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const count = cartCount(lines);

  return (
    <button
      type="button"
      className="cart-mini"
      onClick={openDrawer}
      aria-label={`Ouvrir le panier (${count} article${count > 1 ? "s" : ""})`}
    >
      <ShoppingCartSimple weight="bold" aria-hidden="true" />
      {count > 0 ? <span className="cart-count">{count}</span> : null}
    </button>
  );
}
