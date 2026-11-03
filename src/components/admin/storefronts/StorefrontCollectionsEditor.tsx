"use client";

import { useState } from "react";
import type {
  StorefrontCollectionConfig,
  StorefrontData,
  StorefrontMenuResponse,
} from "@/lib/caisse212/storefront/types";
import {
  slugifyStorefrontName,
  updateStorefrontData,
} from "@/lib/storefront/validation";
import type { EditorCatalog } from "./types";

const KNOWN_KEYS = new Set([
  "key",
  "name",
  "description",
  "imageUrl",
  "categoryIds",
  "productIds",
]);

interface CollectionsEditorProps {
  data: StorefrontData;
  onChange: (data: StorefrontData) => void;
  preview: StorefrontMenuResponse | null;
  catalog: EditorCatalog;
}

function AttributesEditor({
  collection,
  onChange,
}: {
  collection: StorefrontCollectionConfig;
  onChange: (attributes: Record<string, unknown>) => void;
}) {
  const extras = Object.entries(collection).filter(([key]) => !KNOWN_KEYS.has(key));
  const [rows, setRows] = useState(
    extras.length > 0
      ? extras.map(([key, value]) => ({ key, value: String(value ?? "") }))
      : [{ key: "", value: "" }],
  );

  const emit = (next: Array<{ key: string; value: string }>) => {
    setRows(next);
    const attributes: Record<string, unknown> = {};
    for (const row of next) {
      if (!row.key.trim()) continue;
      attributes[row.key.trim()] = row.value;
    }
    onChange(attributes);
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, color: "#a3aca6", marginBottom: 6 }}>
        Attributs supplémentaires (badge, layout…)
      </div>
      {rows.map((row, index) => (
        <div key={index} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            className="admin-input"
            style={{ width: "35%" }}
            value={row.key}
            placeholder="clé"
            onChange={(event) =>
              emit(rows.map((item, i) => (i === index ? { ...item, key: event.target.value } : item)))
            }
          />
          <input
            className="admin-input"
            style={{ flex: 1 }}
            value={row.value}
            placeholder="valeur"
            onChange={(event) =>
              emit(rows.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)))
            }
          />
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={() => emit(rows.filter((_, i) => i !== index))}
            aria-label="Supprimer l'attribut"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="admin-button admin-button-secondary"
        style={{ fontSize: 12 }}
        onClick={() => emit([...rows, { key: "", value: "" }])}
      >
        + Attribut
      </button>
    </div>
  );
}

function MultiPicker({
  label,
  options,
  selectedIds,
  onToggle,
  searchPlaceholder,
}: {
  label: string;
  options: Array<{ id: number; name: string; detail?: string }>;
  selectedIds: number[];
  onToggle: (id: number) => void;
  searchPlaceholder: string;
}) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const visible = options.filter((option) => option.name.toLowerCase().includes(term));

  return (
    <details className="admin-card" style={{ padding: 10, marginTop: 6 }}>
      <summary style={{ cursor: "pointer", fontSize: 13 }}>{label}</summary>
      <input
        className="admin-input"
        style={{ marginTop: 10 }}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={searchPlaceholder}
      />
      <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 8 }}>
        {visible.length === 0 ? (
          <p style={{ color: "#7c857f", fontSize: 12 }}>Aucun résultat.</p>
        ) : (
          visible.map((option) => (
            <label
              key={option.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "5px 0",
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(option.id)}
                onChange={() => onToggle(option.id)}
              />
              <span>{option.name}</span>
              {option.detail ? (
                <span style={{ color: "#7c857f", fontSize: 11 }}>{option.detail}</span>
              ) : null}
            </label>
          ))
        )}
      </div>
    </details>
  );
}

export function StorefrontCollectionsEditor({
  data,
  onChange,
  preview,
  catalog,
}: CollectionsEditorProps) {
  const custom = data.collections !== undefined;
  const collections = data.collections ?? [];

  const update = (updater: (draft: StorefrontData) => void) => {
    onChange(updateStorefrontData(data, updater));
  };

  const setMode = (useCustom: boolean) => {
    if (useCustom === custom) return;
    update((draft) => {
      if (useCustom) {
        draft.collections = [];
      } else {
        delete draft.collections;
      }
    });
  };

  const patch = (index: number, patchValue: Partial<StorefrontCollectionConfig>) => {
    update((draft) => {
      const current = draft.collections?.[index];
      if (!current) return;
      draft.collections![index] = { ...current, ...patchValue };
    });
  };

  const replaceAttributes = (index: number, attributes: Record<string, unknown>) => {
    update((draft) => {
      const current = draft.collections?.[index];
      if (!current) return;
      const known = Object.fromEntries(
        Object.entries(current).filter(([key]) => KNOWN_KEYS.has(key)),
      );
      draft.collections![index] = { ...known, ...attributes } as StorefrontCollectionConfig;
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    update((draft) => {
      if (!draft.collections) return;
      const target = index + direction;
      if (target < 0 || target >= draft.collections.length) return;
      const [item] = draft.collections.splice(index, 1);
      draft.collections.splice(target, 0, item);
    });
  };

  const moveProduct = (collectionIndex: number, productIndex: number, direction: -1 | 1) => {
    update((draft) => {
      const ids = draft.collections?.[collectionIndex]?.productIds;
      if (!ids) return;
      const target = productIndex + direction;
      if (target < 0 || target >= ids.length) return;
      const [id] = ids.splice(productIndex, 1);
      ids.splice(target, 0, id);
    });
  };

  const previewCount = (collection: StorefrontCollectionConfig): number | undefined => {
    if (!preview) return undefined;
    const match = preview.collections.find(
      (item) =>
        (collection.key && item.key === collection.key) ||
        (!collection.key && item.name === collection.name),
    );
    return match?.products.length;
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          className={`admin-button ${!custom ? "" : "admin-button-secondary"}`}
          onClick={() => setMode(false)}
        >
          Utiliser mes catégories telles quelles
        </button>
        <button
          type="button"
          className={`admin-button ${custom ? "" : "admin-button-secondary"}`}
          onClick={() => setMode(true)}
        >
          Sections personnalisées
        </button>
      </div>

      {!custom ? (
        <div className="admin-card">
          <p style={{ margin: 0, color: "#a3aca6", fontSize: 13 }}>
            Le site utilise les catégories réelles du catalogue comme sections. Pour créer
            des sections virtuelles, passez en « Sections personnalisées ».
          </p>
        </div>
      ) : (
        <>
          {collections.length === 0 ? (
            <div className="admin-card" style={{ marginBottom: 12 }}>
              <p style={{ margin: 0, color: "#a3aca6", fontSize: 13 }}>
                Aucune section personnalisée : le menu du site n&apos;aura aucune section.
                Ajoutez-en une ci-dessous.
              </p>
            </div>
          ) : null}

          {collections.map((collection, index) => {
            const count = previewCount(collection);
            return (
              <div className="admin-card" key={index} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ fontSize: 14 }}>
                    {collection.name || "Section sans titre"}
                  </strong>
                  {count !== undefined ? (
                    count === 0 ? (
                      <span className="badge badge-amber" style={{ fontSize: 11 }}>
                        Vide — masquée
                      </span>
                    ) : (
                      <span className="badge badge-green" style={{ fontSize: 11 }}>
                        {count} produits
                      </span>
                    )
                  ) : null}
                  <div style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="admin-button admin-button-secondary"
                    style={{ fontSize: 12, padding: "4px 8px" }}
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Monter la section"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="admin-button admin-button-secondary"
                    style={{ fontSize: 12, padding: "4px 8px" }}
                    onClick={() => move(index, 1)}
                    disabled={index === collections.length - 1}
                    aria-label="Descendre la section"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="admin-button admin-button-secondary"
                    style={{ fontSize: 12, padding: "4px 8px", color: "#ff8a8a" }}
                    onClick={() =>
                      update((draft) => {
                        draft.collections?.splice(index, 1);
                      })
                    }
                  >
                    Supprimer
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
                    Nom
                    <input
                      className="admin-input"
                      value={collection.name}
                      onChange={(event) => {
                        const name = event.target.value;
                        patch(index, {
                          name,
                          key:
                            !collection.key || collection.key === slugifyStorefrontName(collection.name)
                              ? slugifyStorefrontName(name)
                              : collection.key,
                        });
                      }}
                      placeholder="ex. Food"
                    />
                  </label>
                  <label style={{ fontSize: 12 }}>
                    Clé (optionnelle)
                    <input
                      className="admin-input"
                      value={collection.key ?? ""}
                      onChange={(event) =>
                        patch(index, { key: event.target.value.trim() || undefined })
                      }
                      placeholder="auto"
                    />
                  </label>
                  <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
                    Description
                    <textarea
                      className="admin-input"
                      rows={2}
                      value={collection.description ?? ""}
                      onChange={(event) =>
                        patch(index, { description: event.target.value || undefined })
                      }
                    />
                  </label>
                  <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
                    URL de l&apos;image
                    <input
                      className="admin-input"
                      value={collection.imageUrl ?? ""}
                      onChange={(event) =>
                        patch(index, { imageUrl: event.target.value || undefined })
                      }
                      placeholder="https://…/image.jpg"
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 12,
                    marginTop: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: "#a3aca6", marginBottom: 4 }}>
                      Catégories
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(collection.categoryIds ?? []).map((id) => {
                        const category = catalog.categories.find((item) => item.id === id);
                        return (
                          <span key={id} className="badge badge-gray" style={{ fontSize: 11 }}>
                            {category?.name ?? `#${id}`}{" "}
                            <button
                              type="button"
                              aria-label="Retirer la catégorie"
                              style={{ background: "none", border: 0, cursor: "pointer" }}
                              onClick={() =>
                                patch(index, {
                                  categoryIds: (collection.categoryIds ?? []).filter(
                                    (item) => item !== id,
                                  ),
                                })
                              }
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    <MultiPicker
                      label="+ Ajouter des catégories"
                      options={catalog.categories.map((category) => ({
                        id: category.id,
                        name: category.name,
                        detail: `${category.productCount} produits`,
                      }))}
                      selectedIds={collection.categoryIds ?? []}
                      searchPlaceholder="Rechercher une catégorie…"
                      onToggle={(id) => {
                        const current = collection.categoryIds ?? [];
                        patch(index, {
                          categoryIds: current.includes(id)
                            ? current.filter((item) => item !== id)
                            : [...current, id],
                        });
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#a3aca6", marginBottom: 4 }}>
                      Produits (ordre d&apos;affichage)
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(collection.productIds ?? []).map((id, productIndex) => {
                        const product = catalog.products.find((item) => item.id === id);
                        return (
                          <span key={id} className="badge badge-gray" style={{ fontSize: 11 }}>
                            {product?.name ?? `#${id}`}
                            <button
                              type="button"
                              aria-label="Monter le produit"
                              style={{ background: "none", border: 0, cursor: "pointer" }}
                              onClick={() => moveProduct(index, productIndex, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              aria-label="Descendre le produit"
                              style={{ background: "none", border: 0, cursor: "pointer" }}
                              onClick={() => moveProduct(index, productIndex, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              aria-label="Retirer le produit"
                              style={{ background: "none", border: 0, cursor: "pointer" }}
                              onClick={() =>
                                patch(index, {
                                  productIds: (collection.productIds ?? []).filter(
                                    (item) => item !== id,
                                  ),
                                })
                              }
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    <MultiPicker
                      label="+ Ajouter des produits"
                      options={catalog.products.map((product) => ({
                        id: product.id,
                        name: product.name,
                        detail: product.categoryName ?? undefined,
                      }))}
                      selectedIds={collection.productIds ?? []}
                      searchPlaceholder="Rechercher un produit…"
                      onToggle={(id) => {
                        const current = collection.productIds ?? [];
                        patch(index, {
                          productIds: current.includes(id)
                            ? current.filter((item) => item !== id)
                            : [...current, id],
                        });
                      }}
                    />
                  </div>
                </div>

                <AttributesEditor
                  key={`${collection.key ?? "nokey"}:${collection.name}`}
                  collection={collection}
                  onChange={(attributes) => replaceAttributes(index, attributes)}
                />
              </div>
            );
          })}

          <button
            type="button"
            className="admin-button"
            onClick={() =>
              update((draft) => {
                if (!draft.collections) draft.collections = [];
                draft.collections.push({
                  key: "",
                  name: "",
                  categoryIds: [],
                  productIds: [],
                });
              })
            }
          >
            + Ajouter une section
          </button>
        </>
      )}
    </div>
  );
}
