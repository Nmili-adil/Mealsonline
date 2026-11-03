"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/components/admin/AdminProvider";
import type {
  StorefrontAdminPayload,
  StorefrontAdminRecord,
  StorefrontData,
  StorefrontMenuResponse,
} from "@/lib/caisse212/storefront/types";
import type { StorefrontAdminIntegrationStatus } from "@/lib/caisse212/storefront/mode";
import {
  dataSizeBytes,
  isValidOrigin,
  isValidStorefrontSlug,
  omitEmptyKeys,
  slugifyStorefrontName,
  updateStorefrontData,
  validateStorefrontPayload,
  STOREFRONT_DATA_MAX_BYTES,
  STOREFRONT_ORIGINS_MAX,
} from "@/lib/storefront/validation";
import { StorefrontCollectionsEditor } from "./StorefrontCollectionsEditor";
import { StorefrontProductsEditor } from "./StorefrontProductsEditor";
import { StorefrontPreviewPanel } from "./StorefrontPreviewPanel";
import type { EditorCatalog, EditorTab } from "./types";

const TABS: Array<{ key: EditorTab; label: string }> = [
  { key: "general", label: "Général" },
  { key: "access", label: "Accès (CORS)" },
  { key: "sections", label: "Sections" },
  { key: "products", label: "Produits" },
  { key: "appearance", label: "Apparence & contenu" },
  { key: "advanced", label: "Avancé (JSON)" },
];

function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label style={{ fontSize: 12, display: "block", gridColumn: wide ? "1 / -1" : undefined }}>
      {label}
      {children}
      {hint ? (
        <span style={{ display: "block", color: "#7c857f", fontSize: 11, marginTop: 4 }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function JsonEditorTab({
  data,
  onChange,
  onValidityChange,
}: {
  data: StorefrontData;
  onChange: (data: StorefrontData) => void;
  onValidityChange: (valid: boolean) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(data ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);
  const bytes = dataSizeBytes(data ?? {});

  const apply = (nextText: string) => {
    setText(nextText);
    try {
      const parsed = JSON.parse(nextText) as unknown;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        setError("Le document doit être un objet JSON.");
        onValidityChange(false);
        return;
      }
      setError(null);
      onValidityChange(true);
      onChange(parsed as StorefrontData);
    } catch (parseError) {
      setError(
        `JSON invalide : ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      );
      onValidityChange(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span
          style={{
            fontSize: 12,
            color: bytes > STOREFRONT_DATA_MAX_BYTES ? "#ff8a8a" : "#a3aca6",
          }}
        >
          {bytes} octets / {STOREFRONT_DATA_MAX_BYTES / 1024} Ko
        </span>
        <button
          type="button"
          className="admin-button admin-button-secondary"
          style={{ fontSize: 12 }}
          onClick={() => {
            try {
              apply(JSON.stringify(JSON.parse(text), null, 2));
            } catch {
              // error is already displayed
            }
          }}
        >
          Formater
        </button>
      </div>
      <textarea
        className="admin-input"
        value={text}
        onChange={(event) => apply(event.target.value)}
        spellCheck={false}
        rows={24}
        style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, lineHeight: 1.5 }}
        aria-label="Données JSON du site"
      />
      {error ? (
        <p style={{ color: "#ff8a8a", fontSize: 12 }}>{error}</p>
      ) : (
        <p style={{ color: "#7c857f", fontSize: 11 }}>
          Cet éditeur modifie le même objet que les autres onglets. Les clés inconnues sont
          préservées ; la sauvegarde envoie l&apos;objet complet (PUT).
        </p>
      )}
    </div>
  );
}

export function StorefrontEditor({
  mode,
  initialStorefront,
  initialMenu,
  catalog,
  status,
}: {
  mode: "create" | "edit";
  initialStorefront?: StorefrontAdminRecord;
  initialMenu?: StorefrontMenuResponse | null;
  catalog: EditorCatalog;
  status: StorefrontAdminIntegrationStatus;
}) {
  const { csrfToken } = useAdmin();
  const router = useRouter();
  const isNew = mode === "create";

  const [name, setName] = useState(initialStorefront?.name ?? "");
  const [slug, setSlug] = useState(initialStorefront?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [active, setActive] = useState(initialStorefront?.active ?? true);
  const [origins, setOrigins] = useState<string[]>(initialStorefront?.allowedOrigins ?? []);
  const [originDraft, setOriginDraft] = useState("");
  const [originError, setOriginError] = useState<string | null>(null);
  const [data, setData] = useState<StorefrontData>(initialStorefront?.data ?? {});
  const [storefront, setStorefront] = useState(initialStorefront);
  const [tab, setTab] = useState<EditorTab>("general");
  const [jsonValid, setJsonValid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const savedSnapshot = useRef(
    JSON.stringify({
      name: initialStorefront?.name ?? "",
      slug: initialStorefront?.slug ?? "",
      active: initialStorefront?.active ?? true,
      origins: initialStorefront?.allowedOrigins ?? [],
      data: initialStorefront?.data ?? {},
    }),
  );
  const [preview, setPreview] = useState<StorefrontMenuResponse | null>(initialMenu ?? null);
  const [savedPreview, setSavedPreview] = useState<StorefrontMenuResponse | null>(
    initialMenu ?? null,
  );
  const [previewMode, setPreviewMode] = useState<"draft" | "saved">("draft");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewSkipFirst = useRef(false);

  const dirty =
    JSON.stringify({ name, slug, active, origins, data }) !== savedSnapshot.current;
  const id = storefront?.id;
  const publicUrl =
    storefront?.publicUrl ??
    `${status.baseUrl}/api/public/storefront/${slug || "votre-slug"}`;

  const patchData = (updater: (draft: StorefrontData) => void) => {
    setData((current) => updateStorefrontData(current, updater));
  };

  // Debounced unsaved-data preview (edit mode only).
  useEffect(() => {
    if (!id) return;
    if (!previewSkipFirst.current) {
      previewSkipFirst.current = true;
      return;
    }
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const response = await fetch(`/api/admin/storefronts/${id}/menu/preview`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({ data }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          setPreviewError(payload?.error ?? "Aperçu indisponible");
          return;
        }
        setPreviewError(null);
        setPreview(payload.menu as StorefrontMenuResponse);
      } catch {
        setPreviewError("Impossible de contacter le serveur pour l'aperçu");
      } finally {
        setPreviewLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [data, id, csrfToken]);

  const addOrigin = () => {
    const value = originDraft.trim();
    if (!value) return;
    if (!isValidOrigin(value)) {
      setOriginError("Origine invalide : https://hôte[:port] sans chemin, ou *");
      return;
    }
    if (value === "*" && origins.length > 0) {
      setOriginError("Retirez les autres origines avant d'utiliser « * ».");
      return;
    }
    if (origins.includes(value)) {
      setOriginDraft("");
      return;
    }
    if (origins.length >= STOREFRONT_ORIGINS_MAX) {
      setOriginError("20 origines maximum");
      return;
    }
    setOrigins([...origins, value]);
    setOriginDraft("");
    setOriginError(null);
  };

  const save = async () => {
    setError(null);
    setMessage(null);
    if (!jsonValid) {
      setError("Corrigez le JSON invalide dans l'onglet Avancé avant d'enregistrer.");
      return;
    }

    const payload: StorefrontAdminPayload = {
      slug: slug.trim().toLowerCase(),
      name: name.trim(),
      businessId: storefront?.businessId,
      allowedOrigins: origins,
      active,
      data,
    };

    // Fixtures validate ids locally; live mode defers id validation to the
    // Caisse212 backend (the picker never offers guessed ids).
    const idSets =
      status.mode === "fixtures"
        ? {
            categoryIds: new Set(catalog.categories.map((category) => category.id)),
            productIds: new Set(catalog.products.map((product) => product.id)),
          }
        : undefined;
    const validation = validateStorefrontPayload(payload, idSets);
    if (!validation.ok) {
      setError(validation.message ?? "Données invalides");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        isNew || !id ? "/api/admin/storefronts" : `/api/admin/storefronts/${id}`,
        {
          method: isNew || !id ? "POST" : "PUT",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Échec de l'enregistrement");
        return;
      }

      const saved = body.storefront as StorefrontAdminRecord;
      setStorefront(saved);
      savedSnapshot.current = JSON.stringify({
        name: saved.name,
        slug: saved.slug,
        active: saved.active,
        origins: saved.allowedOrigins,
        data: saved.data,
      });
      setName(saved.name);
      setSlug(saved.slug);
      setOrigins(saved.allowedOrigins);
      setData(saved.data);
      setMessage(`Site enregistré · version ${saved.version}`);

      const menuResponse = await fetch(`/api/admin/storefronts/${saved.id}/menu`);
      if (menuResponse.ok) {
        const menuBody = await menuResponse.json().catch(() => null);
        if (menuBody?.menu) {
          setPreview(menuBody.menu as StorefrontMenuResponse);
          setSavedPreview(menuBody.menu as StorefrontMenuResponse);
        }
      }

      if (isNew) {
        router.replace(`/admin/websites/${saved.id}/edit`);
      }
      router.refresh();
    } catch {
      setError("Erreur réseau lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copié.`);
    } catch {
      setError("Impossible de copier dans le presse-papiers.");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <Link href="/admin/websites" className="admin-button admin-button-secondary">
          ← Sites web
        </Link>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>
            {isNew ? "Nouveau site" : `Modifier ${storefront?.name ?? ""}`}
          </h2>
          <p style={{ margin: "3px 0 0", color: "#a3aca6", fontSize: 12 }}>
            {dirty ? (
              <span className="badge badge-amber" style={{ fontSize: 10, marginRight: 6 }}>
                Modifications non enregistrées
              </span>
            ) : null}
            {storefront ? `Version ${storefront.version} · business #${storefront.businessId}` : "Création"}
            {status.mode === "fixtures" ? " · fixtures locales" : ""}
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="admin-button"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {error ? (
        <div className="admin-card" style={{ borderColor: "#b42318", marginBottom: 12 }}>
          <p style={{ margin: 0, color: "#ffb4ab", fontSize: 13 }}>{error}</p>
        </div>
      ) : null}
      {message ? (
        <div className="admin-card" style={{ borderColor: "#2f6b3a", marginBottom: 12 }}>
          <p style={{ margin: 0, color: "#9fe6a0", fontSize: 13 }}>{message}</p>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div>
          <div
            role="tablist"
            aria-label="Configuration du site"
            style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}
          >
            {TABS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={tab === entry.key}
                className={`admin-button ${tab === entry.key ? "" : "admin-button-secondary"}`}
                style={{ fontSize: 12, padding: "7px 12px" }}
                onClick={() => setTab(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {tab === "general" ? (
            <div className="admin-card">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <Field label="Nom du site">
                  <input
                    className="admin-input"
                    value={name}
                    maxLength={120}
                    onChange={(event) => {
                      const value = event.target.value;
                      setName(value);
                      if (!slugTouched && (!initialStorefront || !slug)) {
                        setSlug(slugifyStorefrontName(value));
                      }
                    }}
                  />
                </Field>
                <Field
                  label="Slug"
                  hint="3–63 caractères : minuscules, chiffres et tirets. Changer le slug casse l'URL publique existante."
                >
                  <input
                    className="admin-input"
                    value={slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(slugifyStorefrontName(event.target.value));
                    }}
                  />
                  {!isValidStorefrontSlug(slug) ? (
                    <span style={{ color: "#ff8a8a", fontSize: 11 }}>
                      Slug invalide ou trop court.
                    </span>
                  ) : null}
                  {!isNew && initialStorefront && slug !== initialStorefront.slug ? (
                    <span style={{ color: "#ffd166", fontSize: 11 }}>
                      Attention : l&apos;URL publique existante cessera de fonctionner.
                    </span>
                  ) : null}
                </Field>
                <Field label="Business (lecture seule)" hint="Immuable après création.">
                  <input
                    className="admin-input"
                    value={storefront?.businessId ?? "—"}
                    readOnly
                    disabled
                  />
                </Field>
                <Field label="Actif">
                  <select
                    className="admin-input"
                    value={active ? "yes" : "no"}
                    onChange={(event) => setActive(event.target.value === "yes")}
                  >
                    <option value="yes">Actif</option>
                    <option value="no">Inactif (404 public)</option>
                  </select>
                </Field>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: "#a3aca6", marginBottom: 4 }}>
                  URL de configuration publique
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="admin-input" value={publicUrl} readOnly />
                  <button
                    type="button"
                    className="admin-button admin-button-secondary"
                    onClick={() => void copy(publicUrl, "URL de configuration")}
                  >
                    Copier
                  </button>
                  <a className="admin-button admin-button-secondary" href={publicUrl} target="_blank" rel="noreferrer">
                    Ouvrir
                  </a>
                </div>
                <div style={{ fontSize: 12, color: "#a3aca6", margin: "10px 0 4px" }}>
                  URL du menu public
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="admin-input" value={`${publicUrl}/menu`} readOnly />
                  <button
                    type="button"
                    className="admin-button admin-button-secondary"
                    onClick={() => void copy(`${publicUrl}/menu`, "URL du menu")}
                  >
                    Copier
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "access" ? (
            <div className="admin-card">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={origins.includes("*")}
                  onChange={(event) => {
                    if (event.target.checked) setOrigins(["*"]);
                    else setOrigins([]);
                  }}
                />
                Autoriser n&apos;importe quel site (*)
              </label>

              {!origins.includes("*") ? (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="admin-input"
                      value={originDraft}
                      onChange={(event) => {
                        setOriginDraft(event.target.value);
                        setOriginError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addOrigin();
                        }
                      }}
                      placeholder="https://votre-site.com"
                      aria-label="Ajouter une origine"
                    />
                    <button type="button" className="admin-button admin-button-secondary" onClick={addOrigin}>
                      Ajouter
                    </button>
                  </div>
                  {originError ? (
                    <p style={{ color: "#ff8a8a", fontSize: 12 }}>{originError}</p>
                  ) : null}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {origins.map((origin) => (
                      <span key={origin} className="badge badge-gray" style={{ fontSize: 12 }}>
                        {origin}
                        <button
                          type="button"
                          aria-label="Retirer l'origine"
                          style={{ background: "none", border: 0, cursor: "pointer", marginLeft: 5 }}
                          onClick={() => setOrigins(origins.filter((item) => item !== origin))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ color: "#a3aca6", fontSize: 13 }}>
                  Toute origine navigateur est autorisée. Les appels serveur restent possibles
                  même sans origine.
                </p>
              )}

              <p style={{ color: "#7c857f", fontSize: 11, marginTop: 10 }}>
                {origins.length} / {STOREFRONT_ORIGINS_MAX} origines · origines exactes,
                sans chemin. Ajoutez http://localhost:3000 en développement.
              </p>
              {origins.length === 0 && !origins.includes("*") ? (
                <div className="admin-card" style={{ borderColor: "#8a6d00", marginTop: 10 }}>
                  <p style={{ margin: 0, color: "#ffd166", fontSize: 12 }}>
                    Aucune origine : aucun navigateur ne pourra appeler l&apos;API publique de
                    ce site. Les appels serveur restent possibles.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "sections" ? (
            <StorefrontCollectionsEditor
              data={data}
              onChange={setData}
              preview={preview}
              catalog={catalog}
            />
          ) : null}

          {tab === "products" ? (
            <div className="admin-card">
              <StorefrontProductsEditor data={data} onChange={setData} catalog={catalog} />
            </div>
          ) : null}

          {tab === "appearance" ? (
            <div className="admin-card">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <Field label="Couleur principale">
                  <input
                    className="admin-input"
                    value={data.theme?.primary ?? ""}
                    placeholder="#00e83a"
                    onChange={(event) =>
                      patchData((draft) => {
                        draft.theme = omitEmptyKeys({
                          ...(draft.theme ?? {}),
                          primary: event.target.value,
                        });
                        if (Object.keys(draft.theme).length === 0) delete draft.theme;
                      })
                    }
                  />
                  <input
                    type="color"
                    value={
                      data.theme?.primary && /^#[0-9a-fA-F]{6}$/.test(data.theme.primary)
                        ? data.theme.primary
                        : "#00e83a"
                    }
                    onChange={(event) =>
                      patchData((draft) => {
                        draft.theme = { ...(draft.theme ?? {}), primary: event.target.value };
                      })
                    }
                    style={{ marginTop: 6, height: 32, width: "100%" }}
                    aria-label="Sélecteur de couleur principale"
                  />
                </Field>
                <Field label="Couleur secondaire">
                  <input
                    className="admin-input"
                    value={data.theme?.secondary ?? ""}
                    placeholder="#101513"
                    onChange={(event) =>
                      patchData((draft) => {
                        draft.theme = omitEmptyKeys({
                          ...(draft.theme ?? {}),
                          secondary: event.target.value,
                        });
                        if (Object.keys(draft.theme).length === 0) delete draft.theme;
                      })
                    }
                  />
                </Field>
                <Field label="Logo (URL)">
                  <input
                    className="admin-input"
                    value={data.theme?.logo ?? ""}
                    placeholder="https://…/logo.png"
                    onChange={(event) =>
                      patchData((draft) => {
                        draft.theme = omitEmptyKeys({
                          ...(draft.theme ?? {}),
                          logo: event.target.value,
                        });
                        if (Object.keys(draft.theme).length === 0) delete draft.theme;
                      })
                    }
                  />
                </Field>
                <Field label="Police">
                  <input
                    className="admin-input"
                    value={data.theme?.font ?? ""}
                    placeholder="Manrope"
                    onChange={(event) =>
                      patchData((draft) => {
                        draft.theme = omitEmptyKeys({
                          ...(draft.theme ?? {}),
                          font: event.target.value,
                        });
                        if (Object.keys(draft.theme).length === 0) delete draft.theme;
                      })
                    }
                  />
                </Field>
                <Field label="Titre du héros" wide>
                  <input
                    className="admin-input"
                    value={data.texts?.heroTitle ?? ""}
                    onChange={(event) =>
                      patchData((draft) => {
                        draft.texts = omitEmptyKeys({
                          ...(draft.texts ?? {}),
                          heroTitle: event.target.value,
                        });
                        if (Object.keys(draft.texts).length === 0) delete draft.texts;
                      })
                    }
                  />
                </Field>
                <Field label="Sous-titre du héros" wide>
                  <input
                    className="admin-input"
                    value={data.texts?.heroSubtitle ?? ""}
                    onChange={(event) =>
                      patchData((draft) => {
                        draft.texts = omitEmptyKeys({
                          ...(draft.texts ?? {}),
                          heroSubtitle: event.target.value,
                        });
                        if (Object.keys(draft.texts).length === 0) delete draft.texts;
                      })
                    }
                  />
                </Field>
                <Field label="Pied de page" wide>
                  <textarea
                    className="admin-input"
                    rows={2}
                    value={data.texts?.footer ?? ""}
                    onChange={(event) =>
                      patchData((draft) => {
                        draft.texts = omitEmptyKeys({
                          ...(draft.texts ?? {}),
                          footer: event.target.value,
                        });
                        if (Object.keys(draft.texts).length === 0) delete draft.texts;
                      })
                    }
                  />
                </Field>
                {(["instagram", "facebook", "tiktok", "whatsapp"] as const).map((key) => (
                  <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
                    <input
                      className="admin-input"
                      value={(data.social?.[key] as string | undefined) ?? ""}
                      placeholder={key === "whatsapp" ? "+2126…" : "https://…"}
                      onChange={(event) =>
                        patchData((draft) => {
                          draft.social = omitEmptyKeys({
                            ...(draft.social ?? {}),
                            [key]: event.target.value,
                          });
                          if (Object.keys(draft.social).length === 0) delete draft.social;
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "advanced" ? (
            <div className="admin-card">
              <JsonEditorTab data={data} onChange={setData} onValidityChange={setJsonValid} />
            </div>
          ) : null}
        </div>

        <StorefrontPreviewPanel
          menu={previewMode === "saved" ? savedPreview : preview}
          data={data}
          loading={previewMode === "draft" && previewLoading}
          error={previewMode === "draft" ? previewError : null}
          isNew={isNew}
          mode={previewMode}
          onModeChange={setPreviewMode}
          hasSaved={Boolean(savedPreview)}
        />
      </div>
    </div>
  );
}
