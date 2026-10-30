import "server-only";
import { prisma } from "@/lib/prisma";
import { safeEqualStrings } from "@/lib/crypto";

export interface PublicOrderView {
  reference: string;
  status: string;
  acceptanceState: string;
  preparationState: string;
  paymentState: string;
  fulfillmentState: string;
  fulfillmentType: string;
  currency: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  acceptedAt: string | null;
  items: Array<{
    name: string;
    variantName: string | null;
    quantity: number;
    totalPrice: number;
    modifiers: string[];
    notes: string | null;
  }>;
  restaurant: {
    name: string;
    address: string | null;
    phone: string | null;
    whatsappPhone: string | null;
  };
  timeline: Array<{ eventType: string; toState: string | null; createdAt: string }>;
}

/**
 * Order tracking lookup. The reference alone is NOT sufficient: the caller
 * must present the high-entropy tracking token returned at checkout. Only a
 * redacted public view is ever returned (no phone, address or internal IDs).
 */
export async function getPublicOrder(
  reference: string,
  token: string,
): Promise<PublicOrderView | null> {
  const order = await prisma.onlineOrder.findUnique({
    where: { reference },
    include: {
      items: {
        include: { modifiers: true },
        orderBy: { sortOrder: "asc" },
      },
      events: { orderBy: { createdAt: "asc" } },
      restaurant: true,
    },
  });
  if (!order) return null;
  if (!safeEqualStrings(order.trackingToken, token)) return null;

  return {
    reference: order.reference,
    status: order.status,
    acceptanceState: order.acceptanceState,
    preparationState: order.preparationState,
    paymentState: order.paymentState,
    fulfillmentState: order.fulfillmentState,
    fulfillmentType: order.fulfillmentType,
    currency: order.currency,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    acceptedAt: order.acceptedAt ? order.acceptedAt.toISOString() : null,
    items: order.items.map((item) => ({
      name: item.name,
      variantName: item.variantName,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      modifiers: item.modifiers.map(
        (mod) => `${mod.modifierGroupName}: ${mod.modifierName}`,
      ),
      notes: item.notes,
    })),
    restaurant: {
      name: order.restaurant.name,
      address: order.restaurant.address,
      phone: order.restaurant.phone,
      whatsappPhone: order.restaurant.whatsappPhone,
    },
    timeline: order.events.map((event) => ({
      eventType: event.eventType,
      toState: event.toState,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
