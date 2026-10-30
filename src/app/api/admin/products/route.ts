import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth/guard";
import { jsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const search = request.nextUrl.searchParams.get("search") ?? "";
  const brand = request.nextUrl.searchParams.get("brand") ?? "";

  const products = await prisma.product.findMany({
    where: {
      archived: false,
      ...(search ? { name: { contains: search } } : {}),
      ...(brand ? { brand: { slug: brand } } : {}),
    },
    include: {
      brand: { select: { name: true, slug: true } },
      category: { select: { name: true, slug: true } },
      variants: {
        where: { archived: false },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, price: true, isDefault: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 200,
  });

  return NextResponse.json({
    products: products.map((product) => ({
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
    })),
  });
}
