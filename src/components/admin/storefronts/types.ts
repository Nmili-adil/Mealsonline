export interface EditorCategory {
  id: number;
  name: string;
  description: string | null;
  productCount: number;
}

export interface EditorProduct {
  id: number;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  price: number;
  imageUrl: string | null;
}

export interface EditorCatalog {
  categories: EditorCategory[];
  products: EditorProduct[];
}

export type EditorTab =
  | "general"
  | "access"
  | "sections"
  | "products"
  | "appearance"
  | "advanced";
