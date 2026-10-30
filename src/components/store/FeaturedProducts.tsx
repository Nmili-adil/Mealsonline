"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatMAD } from "@/lib/money";
import type { MenuProduct } from "@/types/menu";

interface MenuApiResponse {
  products: MenuProduct[];
}

/** Homepage "Popular products" section, fed by the synchronized catalog. */
export function FeaturedProducts() {
  const [products, setProducts] = useState<MenuProduct[]>([]);

  useEffect(() => {
    fetch("/api/menu", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: MenuApiResponse | null) => {
        if (!data) return;
        const featured = data.products.filter((product) => product.isFeatured);
        setProducts((featured.length > 0 ? featured : data.products).slice(0, 4));
      })
      .catch(() => undefined);
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="brands-section" id="populaires" style={{ padding: "34px 0 50px" }}>
      <div className="section-title">
        <span className="ornament" aria-hidden="true">◆</span>
        <h2>
          Nos <em>populaires</em>
        </h2>
      </div>
      <div className="page-width product-grid" style={{ paddingBottom: 0, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {products.map((product) => {
          const minPrice = Math.min(...product.variants.map((variant) => variant.price));
          return (
            <Link href={`/menu/${product.slug}`} key={product.id} className="product-card" style={{ color: "inherit" }}>
              <div className="product-card-image">
                <SmartImage src={product.imageUrl} alt={product.name} fill sizes="(max-width: 760px) 90vw, 260px" />
              </div>
              <div className="product-card-body">
                <h3>{product.name}</h3>
                <p>{product.description ?? ""}</p>
                <div className="product-card-foot">
                  <span className="product-price">dès {formatMAD(minPrice)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
