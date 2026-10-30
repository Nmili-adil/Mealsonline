import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart/CartPageClient";

export const metadata: Metadata = {
  title: "Panier",
  description: "Votre panier MealsOnline",
};

export default function CartPage() {
  return (
    <div className="page-width" style={{ paddingBottom: 80 }}>
      <div className="page-head">
        <h1>Votre panier</h1>
        <p>Vérifiez vos articles avant de passer commande.</p>
      </div>
      <CartPageClient />
    </div>
  );
}
