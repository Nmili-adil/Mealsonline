import { z } from "zod";
import { FULFILLMENT_TYPES, PAYMENT_METHODS } from "@/lib/constants";

/**
 * Normalize a Moroccan phone number to international format (+212...).
 * Accepts +212, 00212 or a leading 0 followed by 9 digits.
 */
export function normalizePhone(raw: string): string {
  let value = raw.trim().replace(/[\s.\-()]/g, "");
  if (value.startsWith("00212")) value = `+${value.slice(2)}`;
  if (value.startsWith("0")) value = `+212${value.slice(1)}`;
  return value;
}

export const phoneSchema = z
  .string()
  .min(1, "Le numéro de téléphone est requis")
  .transform((raw) => normalizePhone(raw))
  .refine((value) => /^\+212[5-7]\d{8}$/.test(value), {
    message: "Numéro marocain invalide (ex. +212 6 12 34 56 78)",
  });

export const cartLineSchema = z.object({
  productId: z.string().min(1, "Produit manquant"),
  variantId: z.string().min(1, "Variante manquante"),
  quantity: z.number().int().min(1).max(20),
  modifierIds: z.array(z.string().min(1)).max(30).default([]),
  notes: z.string().max(200).optional(),
});

export const checkoutValidateSchema = z.object({
  brandId: z.string().optional(),
  items: z.array(cartLineSchema).min(1, "Votre panier est vide").max(50),
  fulfillmentType: z.enum(FULFILLMENT_TYPES),
  customerName: z
    .string()
    .min(2, "Nom trop court")
    .max(100, "Nom trop long"),
  phone: phoneSchema,
  deliveryAddress: z.string().max(500).optional(),
  deliveryInstructions: z.string().max(300).optional(),
  orderNote: z.string().max(300).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS.map((p) => p.value) as [string, ...string[]]),
});

export const checkoutSubmitSchema = checkoutValidateSchema.extend({
  approvedTotal: z.number().int().min(0),
  approvePriceChange: z.boolean().default(false),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Email invalide").max(200),
  password: z.string().min(8, "Mot de passe trop court").max(200),
});

export const productPatchSchema = z
  .object({
    websiteVisible: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    isPromoted: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    promotionalSettings: z.record(z.unknown()).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucune modification fournie",
  });

export const categoryPatchSchema = z
  .object({
    visibleOnWebsite: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucune modification fournie",
  });

export const trackingQuerySchema = z.object({
  token: z.string().min(20).max(200),
});

export const menuQuerySchema = z.object({
  brand: z.string().optional(),
  category: z.string().optional(),
});

export const adminSettingsSchema = z.record(z.string(), z.unknown());

export type CheckoutValidateInput = z.infer<typeof checkoutValidateSchema>;
export type CheckoutSubmitInput = z.infer<typeof checkoutSubmitSchema>;
export type CartLineInput = z.infer<typeof cartLineSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;
export type CategoryPatchInput = z.infer<typeof categoryPatchSchema>;
