"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin, Phone } from "@phosphor-icons/react";

interface RestaurantInfo {
  name: string;
  address: string;
  city: string;
  phone: string;
  whatsappPhone: string;
  openingHours: string;
  description: string;
}

/** Homepage restaurant info strip (hours, address, phone). */
export function RestaurantInfoSection() {
  const [info, setInfo] = useState<RestaurantInfo | null>(null);

  useEffect(() => {
    fetch("/api/site-settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setInfo(data.restaurant))
      .catch(() => undefined);
  }, []);

  if (!info) return null;

  return (
    <section className="benefits" aria-label="Informations du restaurant" style={{ padding: "34px 0" }}>
      <div className="page-width benefits-inner" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="benefit">
          <Clock weight="light" aria-hidden="true" />
          <div>
            <strong>Horaires</strong>
            <p style={{ margin: "4px 0 0", color: "#c8c8c2", fontSize: 14 }}>{info.openingHours}</p>
          </div>
        </div>
        <div className="benefit">
          <MapPin weight="light" aria-hidden="true" />
          <div>
            <strong>Adresse</strong>
            <p style={{ margin: "4px 0 0", color: "#c8c8c2", fontSize: 14 }}>{info.address}, {info.city}</p>
          </div>
        </div>
        <div className="benefit">
          <Phone weight="light" aria-hidden="true" />
          <div>
            <strong>Contact</strong>
            <p style={{ margin: "4px 0 0", color: "#c8c8c2", fontSize: 14 }}>
              <a href={`tel:${info.phone}`} style={{ color: "var(--green)" }}>{info.phone}</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
