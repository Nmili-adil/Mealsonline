import "server-only";
import { prisma } from "@/lib/prisma";
import { getDefaultRestaurant } from "@/lib/site";
import { buildStorefrontIdMaps } from "./ids";
import { getStorefrontMode } from "./mode";
import type { StorefrontCatalog } from "./types";

/**
 * Catalog provider for the local storefront fixtures and admin pickers.
 *
 * This is the website's existing Caisse212 catalog mirror (refreshed by the
 * sync worker), not a new catalog database and not a fabricated Caisse212
 * endpoint. The public website still renders the storefront API response in
 * live mode; this provider only feeds fixtures and the admin pickers, where
 * the V206 document does not define category/product listing endpoints.
 */
export async function loadStorefrontCatalog(): Promise<StorefrontCatalog> {
  const restaurant = await getDefaultRestaurant();

  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { restaurantId: restaurant.id, archived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        externalId: true,
        name: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
      },
    }),
    prisma.product.findMany({
      where: { restaurantId: restaurant.id, archived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        variants: {
          where: { archived: false },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            externalId: true,
            name: true,
            price: true,
            isDefault: true,
            sortOrder: true,
          },
        },
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            group: {
              include: {
                modifiers: {
                  where: { archived: false },
                  orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                  select: {
                    id: true,
                    externalId: true,
                    name: true,
                    price: true,
                    sortOrder: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    currency: restaurant.currency || "MAD",
    categories: categories.map((category) => ({
      id: category.id,
      externalId: category.externalId,
      name: category.name,
      description: category.description,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
    })),
    products: products.map((product) => ({
      id: product.id,
      externalId: product.externalId,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      sortOrder: product.sortOrder,
      available: product.caisseAvailable,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        externalId: variant.externalId,
        name: variant.name,
        price: variant.price,
        isDefault: variant.isDefault,
        sortOrder: variant.sortOrder,
      })),
      modifierGroups: product.modifierGroups
        .filter((link) => !link.group.archived)
        .map((link) => ({
          id: link.group.id,
          externalId: link.group.externalId,
          name: link.group.name,
          minSelection: link.group.minSelection,
          maxSelection: link.group.maxSelection,
          required: link.group.required,
          sortOrder: link.group.sortOrder,
          modifiers: link.group.modifiers.map((modifier) => ({
            id: modifier.id,
            externalId: modifier.externalId,
            name: modifier.name,
            price: modifier.price,
            sortOrder: modifier.sortOrder,
          })),
        })),
    })),
  };
}

export interface PickerCategory {
  id: number;
  dbId: string;
  name: string;
  description: string | null;
  productCount: number;
}

export interface PickerProduct {
  id: number;
  dbId: string;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  price: number;
  imageUrl: string | null;
}

/** Categories/products for the admin pickers, with storefront numeric ids. */
export async function loadPickerCatalog(): Promise<{
  categories: PickerCategory[];
  products: PickerProduct[];
}> {
  const catalog = await loadStorefrontCatalog();

  // Live mode: picker ids must be the real Caisse212 numeric ids (the mirror
  // stores them as `externalId`). Never submit guessed/hashed ids live. Rows
  // without a numeric external id are omitted from the picker, and the backend
  // remains the final validator for raw JSON imports.
  if (getStorefrontMode() === "live") {
    const numeric = (value: string | null): number | null => {
      if (!value || !/^\d+$/.test(value)) return null;
      const id = Number(value);
      return Number.isInteger(id) && id > 0 ? id : null;
    };
    const categoryById = new Map(catalog.categories.map((category) => [category.id, category]));
    const categoryNumeric = new Map<string, number>();
    for (const category of catalog.categories) {
      const id = numeric(category.externalId);
      if (id !== null) categoryNumeric.set(category.id, id);
    }

    return {
      categories: catalog.categories
        .map((category) => ({
          id: categoryNumeric.get(category.id) ?? 0,
          dbId: category.id,
          name: category.name,
          description: category.description,
          productCount: catalog.products.filter(
            (product) => product.categoryId === category.id,
          ).length,
        }))
        .filter((category) => category.id > 0),
      products: catalog.products.flatMap((product) => {
        const id = numeric(product.externalId);
        if (id === null) return [];
        const category = product.categoryId ? categoryById.get(product.categoryId) : null;
        const categoryId = category ? (categoryNumeric.get(category.id) ?? null) : null;
        const defaultVariant =
          product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
        return [
          {
            id,
            dbId: product.id,
            name: product.name,
            categoryId,
            categoryName: category?.name ?? null,
            price: defaultVariant?.price ?? 0,
            imageUrl: product.imageUrl,
          },
        ];
      }),
    };
  }

  const maps = buildStorefrontIdMaps(catalog);
  const categoryById = new Map(catalog.categories.map((category) => [category.id, category]));

  return {
    categories: catalog.categories.map((category) => ({
      id: maps.categories.numericByDbId.get(category.id) ?? 0,
      dbId: category.id,
      name: category.name,
      description: category.description,
      productCount: catalog.products.filter((product) => product.categoryId === category.id)
        .length,
    })),
    products: catalog.products.map((product) => {
      const numeric = maps.products.numericByDbId.get(product.id) ?? 0;
      const category = product.categoryId ? categoryById.get(product.categoryId) : null;
      const categoryNumeric = category
        ? (maps.categories.numericByDbId.get(category.id) ?? null)
        : null;
      const defaultVariant =
        product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
      return {
        id: numeric,
        dbId: product.id,
        name: product.name,
        categoryId: categoryNumeric,
        categoryName: category?.name ?? null,
        price: defaultVariant?.price ?? 0,
        imageUrl: product.imageUrl,
      };
    }),
  };
}
