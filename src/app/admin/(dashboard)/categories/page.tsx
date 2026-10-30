import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CategoriesTable } from "@/components/admin/CategoriesTable";

export const metadata: Metadata = { title: "Catégories" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    where: { archived: false },
    include: {
      brand: { select: { name: true } },
      _count: { select: { products: { where: { archived: false } } } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <CategoriesTable
      initial={categories.map((category) => ({
        id: category.id,
        externalId: category.externalId,
        name: category.name,
        slug: category.slug,
        brand: category.brand?.name ?? null,
        visibleOnWebsite: category.visibleOnWebsite,
        sortOrder: category.sortOrder,
        productCount: category._count.products,
      }))}
    />
  );
}
