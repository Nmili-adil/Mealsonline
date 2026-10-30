import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions de commande",
  description: "Conditions générales de commande MealsOnline",
};

export default function TermsPage() {
  return (
    <div className="page-width" style={{ paddingBottom: 80 }}>
      <div className="page-head">
        <h1>Conditions de commande</h1>
        <p>Ce qu'il faut savoir avant de commander en ligne.</p>
      </div>
      <div className="admin-card" style={{ lineHeight: 1.7, color: "#c8c8c2" }}>
        <p>
          Les prix affichés sur le site sont synchronisés avec le restaurant et exprimés en
          dirhams marocains (MAD). Le montant définitif est confirmé au moment de la validation
          de la commande.
        </p>
        <p>
          Une commande en ligne est considérée comme confirmée uniquement après acceptation par
          le point de vente. Le paiement s'effectue à la livraison ou au retrait, selon le mode
          choisi.
        </p>
        <p>
          Pour la livraison, assurez-vous que l'adresse et le numéro de téléphone sont exacts.
          Le restaurant se réserve le droit de refuser une commande en cas d'indisponibilité ou
          d'erreur manifeste de prix.
        </p>
        <p>Cette page est un modèle : complétez-la avec vos conditions définitives.</p>
      </div>
    </div>
  );
}
