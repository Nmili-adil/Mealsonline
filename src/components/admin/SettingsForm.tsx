"use client";

import { useState } from "react";
import { useAdmin } from "./AdminProvider";

interface SiteSettings {
  announcement: { enabled: boolean; message: string };
  hero: { title: string; subtitle: string; imageUrl: string };
  restaurant: {
    name: string;
    tagline: string;
    description: string;
    address: string;
    city: string;
    phone: string;
    whatsappPhone: string;
    openingHours: string;
  };
  seo: { title: string; description: string };
  featured: { brandSlugs: string[]; categorySlugs: string[]; productSlugs: string[] };
}

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const { csrfToken } = useAdmin();
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = <K extends keyof SiteSettings>(section: K, value: SiteSettings[K]) => {
    setSettings((current) => ({ ...current, [section]: value }));
  };

  const save = async (sections: Array<keyof SiteSettings>) => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {};
      for (const section of sections) body[section] = settings[section];
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      setMessage(response.ok ? "Enregistré avec succès." : data.error ?? "Erreur d'enregistrement");
    } catch {
      setMessage("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-grid">
      <div className="admin-card">
        <h3>Bannière d'annonce</h3>
        <div className="form-grid">
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={settings.announcement.enabled}
              onChange={(event) =>
                update("announcement", { ...settings.announcement, enabled: event.target.checked })
              }
              style={{ accentColor: "var(--green)" }}
            />
            Activer la bannière
          </label>
          <div className="field">
            <input
              className="admin-input"
              value={settings.announcement.message}
              onChange={(event) =>
                update("announcement", { ...settings.announcement, message: event.target.value })
              }
              placeholder="Message de la bannière"
            />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3>Section héros</h3>
        <div className="form-grid">
          <div className="field">
            <label>Titre</label>
            <input
              className="admin-input"
              value={settings.hero.title}
              onChange={(event) => update("hero", { ...settings.hero, title: event.target.value })}
            />
          </div>
          <div className="field">
            <label>Sous-titre</label>
            <input
              className="admin-input"
              value={settings.hero.subtitle}
              onChange={(event) => update("hero", { ...settings.hero, subtitle: event.target.value })}
            />
          </div>
          <div className="field">
            <label>Image</label>
            <input
              className="admin-input"
              value={settings.hero.imageUrl}
              onChange={(event) => update("hero", { ...settings.hero, imageUrl: event.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3>Informations du restaurant</h3>
        <div className="form-grid">
          <div className="form-row">
            <div className="field">
              <label>Nom</label>
              <input
                className="admin-input"
                value={settings.restaurant.name}
                onChange={(event) =>
                  update("restaurant", { ...settings.restaurant, name: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Téléphone</label>
              <input
                className="admin-input"
                value={settings.restaurant.phone}
                onChange={(event) =>
                  update("restaurant", { ...settings.restaurant, phone: event.target.value })
                }
              />
            </div>
          </div>
          <div className="field">
            <label>Adresse</label>
            <input
              className="admin-input"
              value={settings.restaurant.address}
              onChange={(event) =>
                update("restaurant", { ...settings.restaurant, address: event.target.value })
              }
            />
          </div>
          <div className="field">
            <label>Horaires</label>
            <input
              className="admin-input"
              value={settings.restaurant.openingHours}
              onChange={(event) =>
                update("restaurant", { ...settings.restaurant, openingHours: event.target.value })
              }
            />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              className="admin-input"
              value={settings.restaurant.description}
              onChange={(event) =>
                update("restaurant", { ...settings.restaurant, description: event.target.value })
              }
            />
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3>SEO</h3>
        <div className="form-grid">
          <div className="field">
            <label>Titre</label>
            <input
              className="admin-input"
              value={settings.seo.title}
              onChange={(event) => update("seo", { ...settings.seo, title: event.target.value })}
            />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              className="admin-input"
              value={settings.seo.description}
              onChange={(event) =>
                update("seo", { ...settings.seo, description: event.target.value })
              }
            />
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          className="admin-button"
          disabled={saving}
          onClick={() => save(["announcement", "hero", "restaurant", "seo"])}
        >
          {saving ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        {message ? <p style={{ color: "#a3aca6", marginTop: 10 }}>{message}</p> : null}
      </div>
    </div>
  );
}
