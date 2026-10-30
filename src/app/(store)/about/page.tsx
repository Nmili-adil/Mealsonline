import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site";

export const metadata: Metadata = {
  title: "À propos",
  description: "Découvrez MealsOnline, trois marques réunies à Hay Izdihar, Marrakech.",
};

export default async function AboutPage() {
  const settings = await getSiteSettings();
  return (
    <div className="page-width" style={{ paddingBottom: 80 }}>
      <div className="page-head">
        <h1>À propos</h1>
        <p>{settings.restaurant.tagline}</p>
      </div>
      <div className="admin-card" style={{ lineHeight: 1.7, color: "#c8c8c2" }}>
        <p>{settings.restaurant.description}</p>
        <p>
          <strong style={{ color: "#f7f9f7" }}>Adresse :</strong> {settings.restaurant.address},{" "}
          {settings.restaurant.city}
        </p>
        <p>
          <strong style={{ color: "#f7f9f7" }}>Horaires :</strong> {settings.restaurant.openingHours}
        </p>
        <p>
          <strong style={{ color: "#f7f9f7" }}>Téléphone :</strong>{" "}
          <a href={`tel:${settings.restaurant.phone}`} style={{ color: "var(--green)" }}>
            {settings.restaurant.phone}
          </a>
        </p>
      </div>
    </div>
  );
}
