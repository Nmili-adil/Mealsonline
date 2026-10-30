"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MenuBrand, MenuCategory, MenuProduct } from "@/types/menu";
import { ProductCard } from "./ProductCard";

export function MenuExplorer({
  brands,
  categories,
  products,
  initialBrand,
}: {
  brands: MenuBrand[];
  categories: MenuCategory[];
  products: MenuProduct[];
  initialBrand?: string | null;
}) {
  const router = useRouter();
  const [brandId, setBrandId] = useState<string | null>(
    initialBrand ? brands.find((b) => b.slug === initialBrand)?.id ?? null : null,
  );
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const visibleCategories = useMemo(
    () =>
      categories.filter(
        (category) => !brandId || category.brandId === brandId || category.brandId === null,
      ),
    [categories, brandId],
  );

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (!brandId || product.brandId === brandId) &&
          (!categoryId || product.categoryId === categoryId),
      ),
    [products, brandId, categoryId],
  );

  const openProduct = (slug: string) => router.push(`/menu/${slug}`);

  return (
    <div>
      <div className="brand-selector" role="group" aria-label="Choisir une marque">
        <button
          type="button"
          className="brand-chip"
          aria-pressed={brandId === null}
          onClick={() => {
            setBrandId(null);
            setCategoryId(null);
          }}
        >
          <span className="brand-dot" style={{ background: "var(--green)" }} />
          Tout le menu
        </button>
        {brands.map((brand) => (
          <button
            type="button"
            key={brand.id}
            className="brand-chip"
            aria-pressed={brandId === brand.id}
            onClick={() => {
              setBrandId(brand.id);
              setCategoryId(null);
            }}
          >
            <span
              className="brand-dot"
              style={{ background: brand.accentColor ?? "var(--green)" }}
            />
            {brand.name}
          </button>
        ))}
      </div>

      <div className="category-chips" role="group" aria-label="Filtrer par catégorie">
        <button
          type="button"
          className="chip"
          aria-pressed={categoryId === null}
          onClick={() => setCategoryId(null)}
        >
          Tout
        </button>
        {visibleCategories.map((category) => (
          <button
            type="button"
            key={category.id}
            className="chip"
            aria-pressed={categoryId === category.id}
            onClick={() => setCategoryId(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {visibleProducts.length === 0 ? (
        <div className="empty-state">
          <h3>Aucun produit</h3>
          <p>Aucun produit ne correspond à cette sélection pour le moment.</p>
        </div>
      ) : (
        <div className="product-grid">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} onOpen={openProduct} />
          ))}
        </div>
      )}
    </div>
  );
}
