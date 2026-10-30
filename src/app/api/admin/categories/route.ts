import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const categories = await prisma.category.findMany({
    where: { archived: false },
    include: {
      brand: { select: { name: true, slug: true } },
      _count: { select: { products: { where: { archived: false } } } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    categories: categories.map((category) => ({
      id: category.id,
      externalId: category.externalId,
      name: category.name,
      slug: category.slug,
      brand: category.brand?.name ?? null,
      visibleOnWebsite: category.visibleOnWebsite,
      sortOrder: category.sortOrder,
      productCount: category._count.products,
    })),
  });
}
