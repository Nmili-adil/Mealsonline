import { z } from "zod";

/**
 * Zod validation for Caisse212 API responses. Every provider response is
 * parsed through these schemas so malformed POS payloads fail loudly and
 * safely instead of corrupting website state.
 */

const brandSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  accentColor: z.string().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

const categorySchema = z.object({
  externalId: z.string().min(1),
  brandExternalId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

const variantSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  price: z.number().int().min(0),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const modifierSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  price: z.number().int().min(0),
  sortOrder: z.number().int().optional(),
});

const modifierGroupSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  minSelection: z.number().int().min(0),
  maxSelection: z.number().int().min(0),
  required: z.boolean(),
  sortOrder: z.number().int().optional(),
  modifiers: z.array(modifierSchema).default([]),
});

const productSchema = z.object({
  externalId: z.string().min(1),
  brandExternalId: z.string().optional(),
  categoryExternalId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  ingredients: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  available: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
  variants: z.array(variantSchema).min(1),
  modifierGroupExternalIds: z.array(z.string()).optional(),
});

export const catalogSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  brands: z.array(brandSchema),
  categories: z.array(categorySchema),
  products: z.array(productSchema),
  modifierGroups: z.array(modifierGroupSchema).default([]),
});

export const catalogChangesSchema = z.object({
  cursor: z.string().min(1),
  generatedAt: z.string().datetime(),
  upserts: catalogSnapshotSchema,
  removed: z.object({
    brands: z.array(z.string()),
    categories: z.array(z.string()),
    products: z.array(z.string()),
  }),
});

export const availabilitySnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  items: z.array(
    z.object({
      externalProductId: z.string().min(1),
      available: z.boolean(),
    }),
  ),
});

export const submitOrderResultSchema = z.object({
  accepted: z.boolean(),
  externalOrderId: z.string().min(1),
  posOrderId: z.string().optional(),
  authoritativeTotal: z.number().int().min(0).optional(),
  repriced: z.boolean().optional(),
  rejectionReason: z.string().optional(),
  acceptedAt: z.string().datetime().optional(),
});

export const externalOrderStatusSchema = z.object({
  externalOrderId: z.string().min(1),
  posOrderId: z.string().optional(),
  acceptance: z.enum(["pending", "accepted", "rejected", "expired"]),
  preparation: z.enum(["pending", "preparing", "ready", "dispatched", "delivered"]),
  fulfillment: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  payment: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  updatedAt: z.string().datetime(),
});
