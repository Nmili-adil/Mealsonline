"use client";

import { useMemo, useState } from "react";
import { useAdmin } from "./AdminProvider";
import { formatMAD } from "@/lib/money";

interface AdminProduct {
  id: string;
  externalId: string | null;
  name: string;
  slug: string;
  brand: string | null;
  category: string | null;
  websiteVisible: boolean;
  caisseAvailable: boolean;
  isFeatured: boolean;
  isPromoted: boolean;
  sortOrder: number;
  promotionalSettings: Record<string, unknown> | null;
  variants: Array<{ id: string; name: string; price: number; isDefault: boolean }>;
}

export function ProductsTable({ initialProducts }: { initialProducts: AdminProduct[] }) {
  const { csrfToken } = useAdmin();
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          (product.brand ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  );

  const patch = async (id: string, data: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        setProducts((current) =>
          current.map((product) => (product.id === id ? { ...product, ...data } : product)),
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="field" style={{ maxWidth: 360, marginBottom: 16 }}>
        <input
          className="admin-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un produit ou une marque…"
        />
      </div>
      <div className="admin-card" style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Marque</th>
              <th>Variantes</th>
              <th>Dispo POS</th>
              <th>Visible site</th>
              <th>En avant</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => (
              <tr key={product.id}>
                <td>
                  <strong>{product.name}</strong>
                  <br />
                  <small style={{ color: "#7c857f" }}>{product.category ?? "—"}</small>
                </td>
                <td>{product.brand ?? "—"}</td>
                <td style={{ fontSize: 12 }}>
                  {product.variants.map((variant) => (
                    <span key={variant.id} style={{ display: "block" }}>
                      {variant.name} · {formatMAD(variant.price)}
                    </span>
                  ))}
                </td>
                <td>
                  <span className={`badge ${product.caisseAvailable ? "badge-green" : "badge-red"}`}>
                    {product.caisseAvailable ? "Disponible" : "Indisponible"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="admin-toggle"
                    data-on={product.websiteVisible}
                    disabled={busyId === product.id}
                    onClick={() => patch(product.id, { websiteVisible: !product.websiteVisible })}
                    aria-label={`Basculer la visibilité de ${product.name}`}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="admin-toggle"
                    data-on={product.isFeatured}
                    disabled={busyId === product.id}
                    onClick={() => patch(product.id, { isFeatured: !product.isFeatured })}
                    aria-label={`Mettre ${product.name} en avant`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p style={{ color: "#a3aca6", padding: 16 }}>Aucun produit trouvé.</p>
        ) : null}
      </div>
    </div>
  );
}
