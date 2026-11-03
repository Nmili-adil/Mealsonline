import { z } from "zod";

/**
 * Runtime validation for Storefront V206 responses. Unknown keys are
 * preserved (`.passthrough()`): storefront `data`, `business`, collection
 * attributes and product detail extras are intentionally extensible.
 */

const unknownRecord = z.record(z.unknown());

export const storefrontDataSchema = z
  .object({
    theme: unknownRecord.optional(),
    texts: unknownRecord.optional(),
    social: unknownRecord.optional(),
    collections: z
      .array(
        z
          .object({
            key: z.string().optional(),
            name: z.string(),
            description: z.string().optional(),
            imageUrl: z.string().optional(),
            categoryIds: z.array(z.number().int()).optional(),
            productIds: z.array(z.number().int()).optional(),
          })
          .passthrough(),
      )
      .optional(),
    hiddenProductIds: z.array(z.number().int()).optional(),
    productOverrides: z
      .record(
        z
          .object({
            name: z.string().optional(),
            description: z.string().optional(),
            imageUrl: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const storefrontConfigSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    version: z.number(),
    menuCode: z.string(),
    orderingEnabled: z.boolean(),
    business: z
      .object({
        name: z.string().optional(),
        address: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        coordinates: z.unknown().optional(),
      })
      .passthrough(),
    data: storefrontDataSchema,
  })
  .passthrough();

export const storefrontMenuProductSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    thumbUrl: z.string().nullable().optional(),
    price: z.number(),
    tvaPct: z.number().optional(),
  })
  .passthrough();

export const storefrontMenuCollectionSchema = z
  .object({
    key: z.string().nullable().optional(),
    name: z.string(),
    description: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    categoryId: z.number().nullable().optional(),
    attributes: z.record(z.unknown()).optional(),
    products: z.array(storefrontMenuProductSchema),
  })
  .passthrough();

export const storefrontMenuSchema = z
  .object({
    collections: z.array(storefrontMenuCollectionSchema),
    tvaPct: z.number(),
    currency: z.string(),
    orderingEnabled: z.boolean(),
    menuCode: z.string(),
    version: z.number(),
  })
  .passthrough();

export const storefrontVariantSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    price: z.number(),
    isDefault: z.boolean().optional(),
  })
  .passthrough();

export const storefrontModifierSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    price: z.number(),
  })
  .passthrough();

export const storefrontModifierGroupSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    minSelection: z.number().int().default(0),
    maxSelection: z.number().int().default(0),
    required: z.boolean().default(false),
    modifiers: z.array(storefrontModifierSchema).default([]),
  })
  .passthrough();

/**
 * ASSUMED CONTRACT — see the note in types.ts. Required fields are limited to
 * what the UI cannot work without; unknown fields are kept.
 */
export const storefrontProductDetailSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    variants: z.array(storefrontVariantSchema).default([]),
    modifierGroups: z.array(storefrontModifierGroupSchema).default([]),
  })
  .passthrough();

const allowedOriginPattern = /^https?:\/\/[^/?#\s]+$/;

export const storefrontOriginSchema = z
  .string()
  .max(300)
  .refine((value) => value === "*" || allowedOriginPattern.test(value), {
    message: "Origine invalide : utilisez https://hôte[:port] ou *",
  });

export const storefrontAdminPayloadSchema = z.object({
  slug: z
    .string()
    .min(3, "Le slug doit contenir au moins 3 caractères")
    .max(63, "Le slug doit contenir au plus 63 caractères")
    .regex(/^[a-z0-9-]+$/, "Slug invalide : minuscules, chiffres et tirets uniquement")
    .refine((value) => !value.startsWith("-") && !value.endsWith("-"), {
      message: "Le slug ne doit pas commencer ni finir par un tiret",
    }),
  name: z
    .string()
    .trim()
    .min(1, "Le nom est requis")
    .max(120, "Le nom doit contenir au plus 120 caractères"),
  businessId: z.number().int().positive().optional(),
  allowedOrigins: z
    .array(storefrontOriginSchema)
    .max(20, "20 origines maximum")
    .default([]),
  active: z.boolean(),
  data: storefrontDataSchema,
});

export const storefrontAdminRecordSchema = storefrontAdminPayloadSchema.extend({
  id: z.number(),
  version: z.number(),
  publicUrl: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StorefrontAdminPayloadParsed = z.infer<typeof storefrontAdminPayloadSchema>;
