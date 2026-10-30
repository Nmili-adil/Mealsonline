/** Client-safe menu shapes serialized from the server. */

export interface MenuBrand {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  accentColor: string | null;
}

export interface MenuCategory {
  id: string;
  slug: string;
  name: string;
  brandId: string | null;
}

export interface MenuVariant {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

export interface MenuModifier {
  id: string;
  name: string;
  price: number;
}

export interface MenuModifierGroup {
  id: string;
  name: string;
  minSelection: number;
  maxSelection: number;
  required: boolean;
  modifiers: MenuModifier[];
}

export interface MenuProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  ingredients: string | null;
  caisseAvailable: boolean;
  isFeatured: boolean;
  isPromoted: boolean;
  brandId: string | null;
  categoryId: string | null;
  variants: MenuVariant[];
  modifierGroups: MenuModifierGroup[];
}
