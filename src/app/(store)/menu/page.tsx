import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { MenuExplorer } from "@/components/menu/MenuExplorer";
import { jsonParse } from "@/lib/utils";
import type { MenuProduct } from "@/types/menu";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Pizzas artisanales, pasta et smash burgers. Choisissez votre marque et composez votre commande.",
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand } = await searchParams;

  const [brands, categories, products] = await Promise.all([
    prisma.brand.findMany({
      where: { archived: false, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        logoUrl: true,
        accentColor: true,
      },
    }),
    prisma.category.findMany({
      where: { archived: false, visibleOnWebsite: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true, brandId: true },
    }),
    prisma.product.findMany({
      where: { archived: false, websiteVisible: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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
    }),
  ]);

  const serializedProducts: MenuProduct[] = products.map((product) => ({
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
  }));

  return (
    <div className="page-width">
      <div className="page-head">
        <h1>Notre menu</h1>
        <p>
          Choisissez une marque, parcourez les catégories et composez votre commande.
          Les prix affichés sont synchronisés avec le restaurant.
        </p>
      </div>
      <MenuExplorer
        brands={brands}
        categories={categories}
        products={serializedProducts}
        initialBrand={brand}
      />
    </div>
  );
}
