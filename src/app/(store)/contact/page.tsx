import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/site";
import { MapPin, Phone, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez MealsOnline — Hay Izdihar, Marrakech.",
};

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const whatsappNumber = (settings.restaurant.whatsappPhone ?? "").replace(/\D/g, "");
  return (
    <div className="page-width" style={{ paddingBottom: 80 }}>
      <div className="page-head">
        <h1>Contact</h1>
        <p>Une question ? Écrivez-nous ou appelez-nous.</p>
      </div>
      <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        <div className="admin-card">
          <MapPin size={26} color="var(--green)" aria-hidden="true" />
          <h3 style={{ marginTop: 10 }}>Adresse</h3>
          <p style={{ color: "#a3aca6", margin: 0 }}>
            {settings.restaurant.address}, {settings.restaurant.city}
          </p>
        </div>
        <div className="admin-card">
          <Phone size={26} color="var(--green)" aria-hidden="true" />
          <h3 style={{ marginTop: 10 }}>Téléphone</h3>
          <p style={{ color: "#a3aca6", margin: 0 }}>
            <a href={`tel:${settings.restaurant.phone}`} style={{ color: "var(--green)" }}>
              {settings.restaurant.phone}
            </a>
          </p>
        </div>
        <div className="admin-card">
          <WhatsappLogo size={26} color="var(--green)" aria-hidden="true" />
          <h3 style={{ marginTop: 10 }}>WhatsApp</h3>
          <p style={{ color: "#a3aca6", margin: 0 }}>
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--green)" }}
            >
              Discuter sur WhatsApp
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
