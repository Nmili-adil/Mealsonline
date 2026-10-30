import "server-only";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { getCaisse212Provider, getIntegrationHealth } from "@/lib/caisse212/client";
import { Caisse212Error } from "@/lib/caisse212/types";
import type { CatalogSnapshot } from "@/lib/caisse212/types";
import { ensureDefaultRestaurant } from "@/lib/site";

export interface CatalogSyncResult {
  runId: string;
  status: "success" | "partial" | "failed";
  mode: "full" | "incremental";
  importedProducts: number;
  updatedProducts: number;
  archivedProducts: number;
  failedRecords: number;
  error?: string;
}

/**
 * Idempotent catalog synchronization.
 *
 * Strategy:
 *  1. Prefer incremental fetchChanges(cursor).
 *  2. If incremental is unavailable or fails, fall back to full snapshot
 *     reconciliation (removed = empty, but soft-archiving below detects
 *     products missing from the full snapshot).
 *  3. Upsert brands → categories → products → variants → modifier groups →
 *     product↔modifier-group links.
 *  4. POS prices always win; website presentation flags are preserved.
 *  5. Availability is applied as a separate pass.
 */
export async function runCatalogSync(): Promise<CatalogSyncResult> {
  const provider = getCaisse212Provider();
  const startedAt = new Date();
  const run = await prisma.menuSyncRun.create({
    data: {
      provider: "caisse212",
      mode: "full",
      status: "running",
    },
  });

  try {
    await ensureDefaultRestaurant();

    let snapshot: CatalogSnapshot;
    let mode: "full" | "incremental" = "full";
    let cursorValue: string | undefined;

    const cursorRow = await prisma.menuSyncCursor.findUnique({
      where: { provider: "caisse212" },
    });

    try {
      const changes = await provider.fetchChanges(cursorRow?.cursor ?? undefined);
      snapshot = changes.upserts;
      cursorValue = changes.cursor;
      mode = cursorRow?.cursor ? "incremental" : "full";

      // Handle explicit removals from the POS.
      if (changes.removed.products.length > 0) {
        await prisma.product.updateMany({
          where: {
            restaurantId: (await ensureDefaultRestaurant()).id,
            externalId: { in: changes.removed.products },
            archived: false,
          },
          data: { archived: true, websiteVisible: false },
        });
      }
      if (changes.removed.categories.length > 0) {
        await prisma.category.updateMany({
          where: {
            restaurantId: (await ensureDefaultRestaurant()).id,
            externalId: { in: changes.removed.categories },
            archived: false,
          },
          data: { archived: true, visibleOnWebsite: false },
        });
      }
      if (changes.removed.brands.length > 0) {
        await prisma.brand.updateMany({
          where: {
            restaurantId: (await ensureDefaultRestaurant()).id,
            externalId: { in: changes.removed.brands },
            archived: false,
          },
          data: { archived: true, isActive: false },
        });
      }
    } catch (error) {
      // Incremental unavailable → full snapshot reconciliation fallback.
      const full = await provider.fetchCatalog();
      snapshot = full;
      cursorValue = String(Date.now());
      mode = "full";
      await prisma.integrationError.create({
        data: {
          scope: "catalog",
          provider: "caisse212",
          operation: "fetchChanges",
          message: error instanceof Error ? error.message : "Échec des changements incrémentaux",
          details: "Bascule vers la réconciliation par snapshot complet",
        },
      });
    }

    const result = await applyCatalogSnapshot(snapshot, mode);

    // Availability pass (separate so a failure here never corrupts catalog).
    let failedRecords = result.failedRecords;
    try {
      const availability = await provider.getAvailability();
      const availableMap = new Map(
        availability.items.map((item) => [item.externalProductId, item.available]),
      );
      const products = await prisma.product.findMany({
        where: { externalId: { not: null }, archived: false },
        select: { id: true, externalId: true },
      });
      for (const product of products) {
        if (!product.externalId || !availableMap.has(product.externalId)) continue;
        await prisma.product.update({
          where: { id: product.id },
          data: { caisseAvailable: availableMap.get(product.externalId)! },
        });
      }
    } catch (error) {
      failedRecords += 1;
      await prisma.integrationError.create({
        data: {
          scope: "catalog",
          provider: "caisse212",
          operation: "getAvailability",
          message: error instanceof Error ? error.message : "Échec de la disponibilité",
        },
      });
    }

    await prisma.menuSyncCursor.upsert({
      where: { provider: "caisse212" },
      create: { provider: "caisse212", cursor: cursorValue, lastSyncAt: new Date() },
      update: { cursor: cursorValue, lastSyncAt: new Date() },
    });

    await prisma.menuSyncRun.update({
      where: { id: run.id },
      data: {
        mode,
        status: failedRecords > 0 ? "partial" : "success",
        finishedAt: new Date(),
        cursor: cursorValue,
        importedProducts: result.importedProducts,
        updatedProducts: result.updatedProducts,
        archivedProducts: result.archivedProducts,
        failedRecords,
      },
    });

    return {
      runId: run.id,
      status: failedRecords > 0 ? "partial" : "success",
      mode,
      importedProducts: result.importedProducts,
      updatedProducts: result.updatedProducts,
      archivedProducts: result.archivedProducts,
      failedRecords,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await prisma.menuSyncRun
      .update({
        where: { id: run.id },
        data: { status: "failed", finishedAt: new Date(), error: message },
      })
      .catch(() => undefined);
    await prisma.integrationError
      .create({
        data: {
          scope: "catalog",
          provider: "caisse212",
          operation: "runCatalogSync",
          message,
        },
      })
      .catch(() => undefined);
    return {
      runId: run.id,
      status: "failed",
      mode: "full",
      importedProducts: 0,
      updatedProducts: 0,
      archivedProducts: 0,
      failedRecords: 1,
      error: message,
    };
  }
}

interface ApplyResult {
  importedProducts: number;
  updatedProducts: number;
  archivedProducts: number;
  failedRecords: number;
}

async function applyCatalogSnapshot(
  snapshot: CatalogSnapshot,
  mode: "full" | "incremental",
): Promise<ApplyResult> {
  const restaurant = await ensureDefaultRestaurant();
  const counters: ApplyResult = {
    importedProducts: 0,
    updatedProducts: 0,
    archivedProducts: 0,
    failedRecords: 0,
  };

  // --- Brands -------------------------------------------------------------
  const brandByExternalId = new Map<string, string>();
  for (const dto of snapshot.brands) {
    const slug = await uniqueSlug("brand", dto.name, dto.externalId, restaurant.id);
    const existing = await prisma.brand.findFirst({
      where: { restaurantId: restaurant.id, externalId: dto.externalId },
    });
    const data = {
      name: dto.name,
      slug,
      tagline: dto.tagline ?? null,
      logoUrl: dto.logoUrl || null,
      imageUrl: dto.imageUrl || null,
      accentColor: dto.accentColor ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.active ?? true,
      archived: false,
    };
    const brand = existing
      ? await prisma.brand.update({ where: { id: existing.id }, data })
      : await prisma.brand.create({
          data: { ...data, restaurantId: restaurant.id, externalId: dto.externalId },
        });
    brandByExternalId.set(dto.externalId, brand.id);
  }

  // --- Categories ----------------------------------------------------------
  const categoryByExternalId = new Map<string, string>();
  for (const dto of snapshot.categories) {
    const slug = await uniqueSlug("category", dto.name, dto.externalId, restaurant.id);
    const existing = await prisma.category.findFirst({
      where: { restaurantId: restaurant.id, externalId: dto.externalId },
    });
    const data = {
      name: dto.name,
      slug,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl || null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.active ?? true,
      archived: false,
      brandId: dto.brandExternalId
        ? brandByExternalId.get(dto.brandExternalId) ?? null
        : null,
    };
    const category = existing
      ? await prisma.category.update({ where: { id: existing.id }, data })
      : await prisma.category.create({
          data: { ...data, restaurantId: restaurant.id, externalId: dto.externalId },
        });
    categoryByExternalId.set(dto.externalId, category.id);
  }

  // --- Modifier groups (top-level) ----------------------------------------
  const modifierGroupByExternalId = new Map<string, string>();
  for (const dto of snapshot.modifierGroups) {
    const existing = await prisma.modifierGroup.findFirst({
      where: { restaurantId: restaurant.id, externalId: dto.externalId },
    });
    const data = {
      name: dto.name,
      minSelection: dto.minSelection,
      maxSelection: dto.maxSelection,
      required: dto.required,
      sortOrder: dto.sortOrder ?? 0,
      archived: false,
    };
    const group = existing
      ? await prisma.modifierGroup.update({ where: { id: existing.id }, data })
      : await prisma.modifierGroup.create({
          data: { ...data, restaurantId: restaurant.id, externalId: dto.externalId },
        });
    modifierGroupByExternalId.set(dto.externalId, group.id);

    for (const modifierDto of dto.modifiers) {
      const existingModifier = await prisma.modifier.findFirst({
        where: { modifierGroupId: group.id, externalId: modifierDto.externalId },
      });
      const modifierData = {
        name: modifierDto.name,
        price: modifierDto.price,
        sortOrder: modifierDto.sortOrder ?? 0,
        archived: false,
      };
      if (existingModifier) {
        await prisma.modifier.update({ where: { id: existingModifier.id }, data: modifierData });
      } else {
        await prisma.modifier.create({
          data: { ...modifierData, modifierGroupId: group.id, externalId: modifierDto.externalId },
        });
      }
    }
  }

  // --- Products ------------------------------------------------------------
  const knownProductExternalIds: string[] = [];
  for (const dto of snapshot.products) {
    knownProductExternalIds.push(dto.externalId);
    const slug = await uniqueSlug("product", dto.name, dto.externalId, restaurant.id);
    const existing = await prisma.product.findFirst({
      where: { restaurantId: restaurant.id, externalId: dto.externalId },
    });
    const data = {
      name: dto.name,
      slug,
      description: dto.description ?? null,
      ingredients: dto.ingredients ? JSON.stringify(dto.ingredients) : null,
      imageUrl: dto.imageUrl || null,
      caisseAvailable: dto.available,
      archived: false,
      brandId: dto.brandExternalId
        ? brandByExternalId.get(dto.brandExternalId) ?? null
        : null,
      categoryId: dto.categoryExternalId
        ? categoryByExternalId.get(dto.categoryExternalId) ?? null
        : null,
      sortOrder: dto.sortOrder ?? 0,
    };

    let productId: string;
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      productId = existing.id;
      counters.updatedProducts += 1;
    } else {
      const product = await prisma.product.create({
        data: { ...data, restaurantId: restaurant.id, externalId: dto.externalId },
      });
      productId = product.id;
      counters.importedProducts += 1;
    }

    // Variants (POS prices always win).
    for (const variantDto of dto.variants) {
      const existingVariant = await prisma.productVariant.findFirst({
        where: { productId, externalId: variantDto.externalId },
      });
      const variantData = {
        name: variantDto.name,
        price: variantDto.price,
        isDefault: variantDto.isDefault ?? false,
        sortOrder: variantDto.sortOrder ?? 0,
        archived: false,
      };
      if (existingVariant) {
        await prisma.productVariant.update({ where: { id: existingVariant.id }, data: variantData });
      } else {
        await prisma.productVariant.create({
          data: { ...variantData, productId, externalId: variantDto.externalId },
        });
      }
    }

    // Product ↔ modifier-group links.
    await prisma.productModifierGroup.deleteMany({ where: { productId } });
    const groupIds = (dto.modifierGroupExternalIds ?? [])
      .map((groupId) => modifierGroupByExternalId.get(groupId))
      .filter((id): id is string => Boolean(id));
    for (let index = 0; index < groupIds.length; index += 1) {
      await prisma.productModifierGroup.create({
        data: { productId, modifierGroupId: groupIds[index], sortOrder: index },
      });
    }
  }

  // Soft-archive products missing from a full snapshot reconciliation.
  if (mode === "full") {
    const archived = await prisma.product.updateMany({
      where: {
        restaurantId: restaurant.id,
        archived: false,
        externalId: { not: null, notIn: knownProductExternalIds },
      },
      data: { archived: true, websiteVisible: false },
    });
    counters.archivedProducts += archived.count;
  }

  return counters;
}

async function uniqueSlug(
  kind: "brand" | "category" | "product",
  name: string,
  externalId: string,
  restaurantId: string,
): Promise<string> {
  const base = slugify(name) || kind;
  let candidate = base;
  let suffix = 0;
  for (;;) {
    const existing = await (kind === "brand"
      ? prisma.brand.findFirst({ where: { restaurantId, slug: candidate } })
      : kind === "category"
        ? prisma.category.findFirst({ where: { restaurantId, slug: candidate } })
        : prisma.product.findFirst({ where: { restaurantId, slug: candidate } }));
    // Allow reuse when the slug belongs to the same external record.
    if (!existing || existing.externalId === externalId) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

/** Small helper used by the admin dashboard. */
export function getIntegrationStatus() {
  return getIntegrationHealth();
}

export function isCaisse212Error(error: unknown): error is Caisse212Error {
  return error instanceof Caisse212Error;
}
