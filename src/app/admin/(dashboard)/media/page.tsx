import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SmartImage } from "@/components/ui/SmartImage";

export const metadata: Metadata = { title: "Médias" };
export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  const images = await prisma.productImage.findMany({
    include: { product: { select: { name: true } } },
    orderBy: [{ productId: "asc" }, { sortOrder: "asc" }],
    take: 100,
  });

  const brandedProducts = await prisma.product.findMany({
    where: { imageUrl: { not: null }, archived: false },
    select: { id: true, name: true, imageUrl: true },
    take: 100,
  });

  return (
    <div className="admin-card">
      <h3>Images produits</h3>
      <p style={{ color: "#a3aca6", fontSize: 14 }}>
        Les images proviennent du catalogue Caisse212 ou des médias locaux. Utilisez la
        synchronisation pour rafraîchir les URLs distantes.
      </p>
      <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        {brandedProducts.map((product) => (
          <div key={product.id} className="admin-card" style={{ padding: 10 }}>
            <div style={{ position: "relative", aspectRatio: "16/10", borderRadius: 10, overflow: "hidden" }}>
              <SmartImage src={product.imageUrl} alt={product.name} fill sizes="160px" />
            </div>
            <p style={{ fontSize: 12, margin: "8px 0 0" }}>{product.name}</p>
          </div>
        ))}
        {images.map((image) => (
          <div key={image.id} className="admin-card" style={{ padding: 10 }}>
            <div style={{ position: "relative", aspectRatio: "16/10", borderRadius: 10, overflow: "hidden" }}>
              <SmartImage src={image.url} alt={image.alt ?? image.product.name} fill sizes="160px" />
            </div>
            <p style={{ fontSize: 12, margin: "8px 0 0" }}>{image.product.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
