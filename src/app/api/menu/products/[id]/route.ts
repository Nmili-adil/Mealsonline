import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
      archived: false,
    },
    include: {
      variants: { where: { archived: false }, orderBy: { sortOrder: "asc" } },
      modifierGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          group: {
            include: {
              modifiers: { where: { archived: false }, orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    ingredients: jsonParse<string[]>(product.ingredients, []),
    caisseAvailable: product.caisseAvailable,
    websiteVisible: product.websiteVisible,
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
  });
}
