import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { jsonParse } from "@/lib/utils";

export const metadata: Metadata = { title: "Produits" };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    where: { archived: false },
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      variants: {
        where: { archived: false },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, price: true, isDefault: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 500,
  });

  return (
    <ProductsTable
      initialProducts={products.map((product) => ({
        id: product.id,
        externalId: product.externalId,
        name: product.name,
        slug: product.slug,
        brand: product.brand?.name ?? null,
        category: product.category?.name ?? null,
        websiteVisible: product.websiteVisible,
        caisseAvailable: product.caisseAvailable,
        isFeatured: product.isFeatured,
        isPromoted: product.isPromoted,
        sortOrder: product.sortOrder,
        promotionalSettings: jsonParse<Record<string, unknown> | null>(
          product.promotionalSettings,
          null,
        ),
        variants: product.variants,
      }))}
    />
  );
}
