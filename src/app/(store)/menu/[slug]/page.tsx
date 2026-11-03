import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductDetailClient } from "@/components/menu/ProductDetailClient";
import { jsonParse } from "@/lib/utils";
import type { MenuProduct } from "@/types/menu";
import {
  getConfiguredStorefrontConfig,
  getPublicStorefrontProduct,
} from "@/lib/caisse212/storefront/public";
import { getStorefrontMode } from "@/lib/caisse212/storefront/mode";
import { storefrontErrorMessage } from "@/lib/caisse212/storefront/errors";
import { storefrontDetailToMenuProduct } from "@/lib/storefront/to-menu";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (getStorefrontMode() !== "off") {
    const id = Number(slug);
    if (!Number.isInteger(id)) return { title: "Produit" };
    try {
      const config = await getConfiguredStorefrontConfig();
      if (!config) return { title: "Produit" };
      const detail = await getPublicStorefrontProduct(config.menuCode, id);
      return {
        title: detail?.name ?? "Produit",
        description: detail?.description ?? "Détails du produit",
      };
    } catch {
      return { title: "Produit" };
    }
  }

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

  if (getStorefrontMode() !== "off") {
    const id = Number(slug);
    if (!Number.isInteger(id) || id <= 0) notFound();

    try {
      const config = await getConfiguredStorefrontConfig();
      if (!config) notFound();
      const detail = await getPublicStorefrontProduct(config.menuCode, id);
      if (!detail || detail.variants.length === 0) notFound();

      return (
        <ProductDetailClient
          product={storefrontDetailToMenuProduct(detail)}
          orderingEnabled={config.orderingEnabled}
        />
      );
    } catch (error) {
      return (
        <div className="page-width" style={{ padding: "60px 0" }}>
          <div className="empty-state">
            <h3>Produit momentanément indisponible</h3>
            <p>{storefrontErrorMessage(error)}</p>
          </div>
        </div>
      );
    }
  }

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
