"use client";

import { useState } from "react";
import { useAdmin } from "./AdminProvider";

interface AdminCategory {
  id: string;
  externalId: string | null;
  name: string;
  slug: string;
  brand: string | null;
  visibleOnWebsite: boolean;
  sortOrder: number;
  productCount: number;
}

export function CategoriesTable({ initial }: { initial: AdminCategory[] }) {
  const { csrfToken } = useAdmin();
  const [categories, setCategories] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggle = async (id: string, visibleOnWebsite: boolean) => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ visibleOnWebsite }),
      });
      if (response.ok) {
        setCategories((current) =>
          current.map((category) =>
            category.id === id ? { ...category, visibleOnWebsite } : category,
          ),
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-card" style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Marque</th>
            <th>Produits</th>
            <th>Ordre</th>
            <th>Visible site</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id}>
              <td><strong>{category.name}</strong></td>
              <td>{category.brand ?? "—"}</td>
              <td>{category.productCount}</td>
              <td>{category.sortOrder}</td>
              <td>
                <button
                  type="button"
                  className="admin-toggle"
                  data-on={category.visibleOnWebsite}
                  disabled={busyId === category.id}
                  onClick={() => toggle(category.id, !category.visibleOnWebsite)}
                  aria-label={`Basculer la visibilité de ${category.name}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
