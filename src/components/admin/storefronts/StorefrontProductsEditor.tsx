"use client";

import { useState } from "react";
import type {
  StorefrontData,
  StorefrontProductOverride,
} from "@/lib/caisse212/storefront/types";
import { formatMAD } from "@/lib/money";
import { updateStorefrontData } from "@/lib/storefront/validation";
import type { EditorCatalog, EditorProduct } from "./types";

export function StorefrontProductsEditor({
  data,
  onChange,
  catalog,
}: {
  data: StorefrontData;
  onChange: (data: StorefrontData) => void;
  catalog: EditorCatalog;
}) {
  const [search, setSearch] = useState("");
  const [overrideSearch, setOverrideSearch] = useState("");

  const hidden = data.hiddenProductIds ?? [];
  const overrides = data.productOverrides ?? {};

  const update = (updater: (draft: StorefrontData) => void) => {
    onChange(updateStorefrontData(data, updater));
  };

  const toggleHidden = (id: number) => {
    update((draft) => {
      const current = draft.hiddenProductIds ?? [];
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      if (next.length === 0) delete draft.hiddenProductIds;
      else draft.hiddenProductIds = next;
    });
  };

  const patchOverride = (id: string, patch: Partial<StorefrontProductOverride>) => {
    const next = { ...overrides, [id]: { ...overrides[id], ...patch } };
    for (const key of Object.keys(next[id])) {
      if (next[id][key as keyof StorefrontProductOverride] === "") {
        delete next[id][key as keyof StorefrontProductOverride];
      }
    }
    update((draft) => {
      draft.productOverrides = next;
    });
  };

  const removeOverride = (id: string) => {
    const next = { ...overrides };
    delete next[id];
    update((draft) => {
      if (Object.keys(next).length === 0) delete draft.productOverrides;
      else draft.productOverrides = next;
    });
  };

  const addOverride = (product: EditorProduct) => {
    update((draft) => {
      draft.productOverrides = { ...(draft.productOverrides ?? {}), [String(product.id)]: {} };
    });
  };

  const term = search.trim().toLowerCase();
  const visibleProducts = catalog.products.filter((product) =>
    product.name.toLowerCase().includes(term),
  );

  const availableToOverride = catalog.products.filter(
    (product) =>
      !overrides[String(product.id)] &&
      product.name.toLowerCase().includes(overrideSearch.trim().toLowerCase()),
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section>
        <h3 style={{ fontSize: 15, margin: "0 0 6px" }}>Produits masqués</h3>
        <p style={{ color: "#a3aca6", fontSize: 12, margin: "0 0 10px" }}>
          Ces produits n'apparaîtront jamais dans le menu de ce site. Ils restent dans le
          catalogue et peuvent être visibles sur d&apos;autres sites.
        </p>

        {hidden.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {hidden.map((id) => {
              const product = catalog.products.find((item) => item.id === id);
              return (
                <span key={id} className="badge badge-gray" style={{ fontSize: 12 }}>
                  {product?.name ?? `#${id}`}
                  <button
                    type="button"
                    aria-label="Retirer des produits masqués"
                    style={{ background: "none", border: 0, cursor: "pointer", marginLeft: 4 }}
                    onClick={() => toggleHidden(id)}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}

        <input
          className="admin-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un produit à masquer…"
          aria-label="Rechercher un produit à masquer"
        />
        <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 8 }}>
          {visibleProducts.slice(0, 100).map((product) => (
            <label
              key={product.id}
              style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={hidden.includes(product.id)}
                onChange={() => toggleHidden(product.id)}
              />
              <span>{product.name}</span>
              <span style={{ color: "#7c857f", fontSize: 11 }}>
                {product.categoryName ?? "—"}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 15, margin: "0 0 6px" }}>Remplacements de produits</h3>
        <p style={{ color: "#a3aca6", fontSize: 12, margin: "0 0 10px" }}>
          Modifiez uniquement le nom, la description et l&apos;image affichés sur ce site.
          Le prix provient toujours du catalogue et ne peut pas être remplacé.
        </p>

        {Object.entries(overrides).length === 0 ? (
          <p style={{ color: "#7c857f", fontSize: 13 }}>Aucun remplacement.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {Object.entries(overrides).map(([id, override]) => {
              const numericId = Number(id);
              const product = catalog.products.find((item) => item.id === numericId);
              return (
                <div key={id} className="admin-card" style={{ padding: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>{product?.name ?? `#${id}`}</strong>
                    <span className="badge badge-gray" style={{ fontSize: 11 }}>
                      Prix catalogue : {product ? formatMAD(product.price) : "—"}
                    </span>
                    <button
                      type="button"
                      className="admin-button admin-button-secondary"
                      style={{ fontSize: 11, padding: "4px 8px", color: "#ff8a8a" }}
                      onClick={() => removeOverride(id)}
                    >
                      Retirer
                    </button>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <label style={{ fontSize: 12 }}>
                      Nom affiché
                      <input
                        className="admin-input"
                        value={override.name ?? ""}
                        placeholder={product?.name}
                        onChange={(event) => patchOverride(id, { name: event.target.value })}
                      />
                    </label>
                    <label style={{ fontSize: 12 }}>
                      URL de l&apos;image
                      <input
                        className="admin-input"
                        value={override.imageUrl ?? ""}
                        placeholder="https://…"
                        onChange={(event) => patchOverride(id, { imageUrl: event.target.value })}
                      />
                    </label>
                    <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
                      Description affichée
                      <textarea
                        className="admin-input"
                        rows={2}
                        value={override.description ?? ""}
                        onChange={(event) =>
                          patchOverride(id, { description: event.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <input
            className="admin-input"
            value={overrideSearch}
            onChange={(event) => setOverrideSearch(event.target.value)}
            placeholder="Rechercher un produit à remplacer…"
            aria-label="Rechercher un produit à remplacer"
          />
          <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 8 }}>
            {availableToOverride.slice(0, 50).map((product) => (
              <div
                key={product.id}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}
              >
                <span style={{ flex: 1, fontSize: 13 }}>{product.name}</span>
                <button
                  type="button"
                  className="admin-button admin-button-secondary"
                  style={{ fontSize: 11, padding: "4px 8px" }}
                  onClick={() => addOverride(product)}
                >
                  + Remplacer
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
