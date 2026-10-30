import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const products = await prisma.product.findMany({
    where: { archived: false, websiteVisible: true },
    select: { slug: true, updatedAt: true },
  });

  const staticRoutes = [
    "",
    "/menu",
    "/cart",
    "/checkout",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }));

  const productRoutes = products.map((product) => ({
    url: `${baseUrl}/menu/${product.slug}`,
    lastModified: product.updatedAt,
  }));

  return [...staticRoutes, ...productRoutes];
}
