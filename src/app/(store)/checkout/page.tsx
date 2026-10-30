import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = {
  title: "Commander",
  description: "Finalisez votre commande MealsOnline — livraison ou retrait.",
};

export default function CheckoutPage() {
  return (
    <div className="page-width" style={{ paddingBottom: 80 }}>
      <div className="page-head">
        <h1>Finaliser la commande</h1>
        <p>
          Choisissez le mode de commande, renseignez vos informations et validez.
          Le montant final est confirmé par le restaurant.
        </p>
      </div>
      <CheckoutForm />
    </div>
  );
}
