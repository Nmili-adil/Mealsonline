import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Politique de confidentialité MealsOnline",
};

export default function PrivacyPage() {
  return (
    <div className="page-width" style={{ paddingBottom: 80 }}>
      <div className="page-head">
        <h1>Politique de confidentialité</h1>
        <p>Comment nous traitons vos données personnelles.</p>
      </div>
      <div className="admin-card" style={{ lineHeight: 1.7, color: "#c8c8c2" }}>
        <p>
          MealsOnline collecte uniquement les informations nécessaires au traitement de votre
          commande : nom, numéro de téléphone et, pour la livraison, votre adresse.
        </p>
        <p>
          Ces informations sont transmises au restaurant (Caisse212) uniquement pour préparer et
          livrer votre commande. Elles ne sont jamais vendues ni utilisées à des fins
          publicitaires.
        </p>
        <p>
          Les données de commande sont conservées pour des raisons comptables et de suivi.
          Vous pouvez demander leur suppression en nous contactant.
        </p>
        <p>Cette page est un modèle : complétez-la avec vos mentions légales définitives.</p>
      </div>
    </div>
  );
}
