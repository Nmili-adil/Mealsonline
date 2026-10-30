import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const brandSlug = request.nextUrl.searchParams.get("brand");
  const categorySlug = request.nextUrl.searchParams.get("category");

  const where = {
    archived: false,
    websiteVisible: true,
    caisseAvailable: true,
    ...(brandSlug ? { brand: { slug: brandSlug } } : {}),
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
  };

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
      where,
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

  const payload = {
    brands,
    categories,
    products: products.map((product) => ({
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
    })),
  };

  return NextResponse.json(payload);
}
