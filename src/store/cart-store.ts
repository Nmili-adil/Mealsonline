"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartModifierRef {
  modifierId: string;
}

export interface CartLine {
  lineId: string;
  productId: string;
  productName: string;
  productImage: string | null;
  brandId: string | null;
  variantId: string;
  variantName: string;
  unitPrice: number; // minor units (display estimate only)
  quantity: number;
  modifierIds: string[];
  notes?: string;
}

interface CartState {
  lines: CartLine[];
  isDrawerOpen: boolean;
  addLine: (line: Omit<CartLine, "lineId" | "quantity"> & { quantity?: number }) => void;
  removeLine: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  updateNotes: (lineId: string, notes: string) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

function buildLineId(
  productId: string,
  variantId: string,
  modifierIds: string[],
): string {
  const sorted = [...modifierIds].sort();
  return `${productId}::${variantId}::${sorted.join(",")}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      isDrawerOpen: false,

      addLine: (line) =>
        set((state) => {
          const lineId = buildLineId(line.productId, line.variantId, line.modifierIds);
          const existing = state.lines.find((l) => l.lineId === lineId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.lineId === lineId
                  ? { ...l, quantity: Math.min(20, l.quantity + (line.quantity ?? 1)) }
                  : l,
              ),
              isDrawerOpen: true,
            };
          }
          return {
            lines: [
              ...state.lines,
              {
                ...line,
                lineId,
                quantity: Math.min(20, line.quantity ?? 1),
                notes: line.notes ?? "",
              },
            ],
            isDrawerOpen: true,
          };
        }),

      removeLine: (lineId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

      setQuantity: (lineId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.lineId !== lineId)
              : state.lines.map((l) =>
                  l.lineId === lineId ? { ...l, quantity: Math.min(20, quantity) } : l,
                ),
        })),

      updateNotes: (lineId, notes) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, notes } : l)),
        })),

      clearCart: () => set({ lines: [] }),

      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
    }),
    {
      name: "mealsonline-cart-v1",
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

/** Estimate helpers (display only — checkout always revalidates server-side). */
export function cartSubtotalMinor(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/** Shared server shape used by checkout API calls. */
export function cartLinesToPayload(lines: CartLine[]) {
  return lines.map((line) => ({
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
    modifierIds: line.modifierIds,
    notes: line.notes || undefined,
  }));
}
