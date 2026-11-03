"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Info } from "@phosphor-icons/react";
import type {
  StorefrontMenuCollection,
  StorefrontMenuProduct,
} from "@/lib/caisse212/storefront/types";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatMAD } from "@/lib/money";

function StorefrontProductCard({
  product,
  orderingEnabled,
}: {
  product: StorefrontMenuProduct;
  orderingEnabled: boolean;
}) {
  return (
    <article className="product-card">
      <Link
        href={`/menu/${product.id}`}
        className="product-card-image"
        aria-label={`Voir ${product.name}`}
      >
        <SmartImage
          src={product.imageUrl ?? product.thumbUrl}
          alt={product.name}
          fill
          sizes="(max-width: 760px) 90vw, 320px"
        />
      </Link>
      <div className="product-card-body">
        <h3>{product.name}</h3>
        <p>{product.description ?? "Sans description"}</p>
        <div className="product-card-foot">
          <span className="product-price">{formatMAD(product.price)}</span>
          <Link href={`/menu/${product.id}`} className="product-add">
            {orderingEnabled ? "Personnaliser" : "Voir"}
            <ArrowRight weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * Renders the collections exactly as returned by the Storefront V206 menu.
 * The backend already applies custom sections, hidden products, overrides and
 * availability filtering; this component never re-derives those rules.
 */
export function StorefrontMenuExplorer({
  collections,
  orderingEnabled,
}: {
  collections: StorefrontMenuCollection[];
  orderingEnabled: boolean;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (!activeKey) return collections;
    return collections.filter(
      (collection, index) =>
        (collection.key ?? `${collection.name}-${index}`) === activeKey,
    );
  }, [activeKey, collections]);

  if (collections.length === 0) {
    return (
      <div className="empty-state">
        <h3>Menu indisponible</h3>
        <p>Ce site n&apos;a aucune section de menu pour le moment.</p>
      </div>
    );
  }

  return (
    <div>
      {!orderingEnabled ? (
        <div
          className="price-change-banner"
          style={{ marginBottom: 18, display: "flex", gap: 10, alignItems: "flex-start" }}
        >
          <Info weight="bold" aria-hidden="true" style={{ marginTop: 2 }} />
          <span>
            Les commandes en ligne sont momentanément désactivées. Le menu reste
            consultable.
          </span>
        </div>
      ) : null}

      <div className="category-chips" role="group" aria-label="Sections du menu">
        <button
          type="button"
          className="chip"
          aria-pressed={activeKey === null}
          onClick={() => setActiveKey(null)}
        >
          Tout
        </button>
        {collections.map((collection, index) => {
          const key = collection.key ?? `${collection.name}-${index}`;
          return (
            <button
              type="button"
              key={key}
              className="chip"
              aria-pressed={activeKey === key}
              onClick={() => setActiveKey(key)}
            >
              {collection.name}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 34 }}>
        {visible.map((collection, index) => (
          <section
            key={collection.key ?? `${collection.name}-${index}`}
            aria-labelledby={`storefront-section-${index}`}
          >
            <div className="section-title" style={{ marginBottom: 16 }}>
              <span className="ornament" aria-hidden="true">
                ◆
              </span>
              <h2 id={`storefront-section-${index}`} style={{ fontSize: "clamp(22px, 3vw, 30px)" }}>
                {collection.name}
              </h2>
            </div>
            {collection.description ? (
              <p style={{ color: "#a3aca6", margin: "0 0 16px", maxWidth: 680 }}>
                {collection.description}
              </p>
            ) : null}
            <div className="product-grid" style={{ paddingBottom: 0 }}>
              {collection.products.map((product) => (
                <StorefrontProductCard
                  key={product.id}
                  product={product}
                  orderingEnabled={orderingEnabled}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
