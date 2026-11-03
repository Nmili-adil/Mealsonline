"use client";

import type {
  StorefrontData,
  StorefrontMenuResponse,
} from "@/lib/caisse212/storefront/types";
import { formatMAD } from "@/lib/money";

export function StorefrontPreviewPanel({
  menu,
  data,
  loading,
  error,
  isNew,
  mode,
  onModeChange,
  hasSaved,
}: {
  menu: StorefrontMenuResponse | null;
  data: StorefrontData;
  loading: boolean;
  error: string | null;
  isNew: boolean;
  mode: "draft" | "saved";
  onModeChange: (mode: "draft" | "saved") => void;
  hasSaved: boolean;
}) {
  const primary = data.theme?.primary && /^#[0-9a-fA-F]{3,8}$/.test(data.theme.primary)
    ? data.theme.primary
    : "#00e83a";
  const heroTitle = data.texts?.heroTitle;
  const heroSubtitle = data.texts?.heroSubtitle;

  return (
    <div className="admin-card" style={{ padding: 0, overflow: "hidden", position: "sticky", top: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 14px",
          borderBottom: "1px solid #26302b",
        }}
      >
        <strong style={{ fontSize: 13 }}>Aperçu</strong>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            className={`admin-button ${mode === "draft" ? "" : "admin-button-secondary"}`}
            style={{ fontSize: 10, padding: "3px 7px" }}
            onClick={() => onModeChange("draft")}
          >
            Brouillon
          </button>
          <button
            type="button"
            className={`admin-button ${mode === "saved" ? "" : "admin-button-secondary"}`}
            style={{ fontSize: 10, padding: "3px 7px" }}
            onClick={() => onModeChange("saved")}
            disabled={!hasSaved}
          >
            Enregistré
          </button>
        </div>
        <span style={{ fontSize: 11, color: "#7c857f" }}>
          {menu ? `v${menu.version}` : "—"}
        </span>
      </div>

      <div style={{ maxHeight: "70vh", overflowY: "auto", padding: 14 }}>
        {isNew && mode === "draft" ? (
          <p style={{ color: "#a3aca6", fontSize: 13 }}>
            L&apos;aperçu est disponible après le premier enregistrement.
          </p>
        ) : loading ? (
          <p style={{ color: "#7c857f", fontSize: 13 }}>Construction de l&apos;aperçu…</p>
        ) : !menu ? (
          <p style={{ color: "#a3aca6", fontSize: 13 }}>
            Aucun aperçu disponible pour le moment.
          </p>
        ) : (
          <>
            {error ? (
              <p
                style={{
                  background: "#3a1d1d",
                  border: "1px solid #7a2e2e",
                  color: "#ffb4ab",
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 12,
                }}
              >
                {error}
              </p>
            ) : null}

            {(heroTitle || heroSubtitle) && (
              <div
                style={{
                  background: primary,
                  color: "#06110b",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                {heroTitle ? (
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{heroTitle}</div>
                ) : null}
                {heroSubtitle ? (
                  <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>
                    {heroSubtitle}
                  </div>
                ) : null}
              </div>
            )}

            {menu.collections.length === 0 ? (
              <p style={{ color: "#7c857f", fontSize: 13 }}>Le menu n&apos;a aucune section.</p>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {menu.collections.map((collection, index) => (
                  <section key={`${collection.key ?? collection.name}-${index}`}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 6,
                      }}
                    >
                      <strong style={{ color: primary, fontSize: 14 }}>
                        {collection.name}
                      </strong>
                      <span style={{ color: "#7c857f", fontSize: 11 }}>
                        {collection.products.length} produits
                      </span>
                    </div>
                    {collection.description ? (
                      <p style={{ color: "#a3aca6", fontSize: 11, margin: "0 0 6px" }}>
                        {collection.description}
                      </p>
                    ) : null}
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {collection.products.map((product) => (
                        <li
                          key={product.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            padding: "5px 0",
                            borderBottom: "1px solid #1c2420",
                            fontSize: 12,
                          }}
                        >
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {product.name}
                          </span>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {formatMAD(product.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {data.texts?.footer ? (
              <p
                style={{
                  color: "#7c857f",
                  fontSize: 11,
                  textAlign: "center",
                  marginTop: 16,
                  borderTop: "1px solid #1c2420",
                  paddingTop: 10,
                }}
              >
                {data.texts.footer}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
