import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductDetailClient } from "@/components/menu/ProductDetailClient";
import { jsonParse } from "@/lib/utils";
import type { MenuProduct } from "@/types/menu";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, archived: false },
    select: { name: true, description: true },
  });
  return {
    title: product?.name ?? "Produit",
    description: product?.description ?? "Détails du produit",
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, archived: false },
    include: {
      variants: {
        where: { archived: false },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, price: true, isDefault: true },
      },
      modifierGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          group: {
            include: {
              modifiers: {
                where: { archived: false },
                orderBy: { sortOrder: "asc" },
                select: { id: true, name: true, price: true },
              },
            },
          },
        },
      },
    },
  });

  if (!product || !product.websiteVisible) notFound();

  const menuProduct: MenuProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    ingredients: jsonParse<string[]>(product.ingredients, []).join(", ") || null,
    caisseAvailable: product.caisseAvailable,
    isFeatured: product.isFeatured,
    isPromoted: product.isPromoted,
    brandId: product.brandId,
    categoryId: product.categoryId,
    variants: product.variants,
    modifierGroups: product.modifierGroups.map((link) => ({
      id: link.group.id,
      name: link.group.name,
      minSelection: link.group.minSelection,
      maxSelection: link.group.maxSelection,
      required: link.group.required,
      modifiers: link.group.modifiers,
    })),
  };

  return <ProductDetailClient product={menuProduct} />;
}
