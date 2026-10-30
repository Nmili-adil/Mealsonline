import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth/guard";
import { formatMAD } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const order = await prisma.onlineOrder.findUnique({
    where: { id },
    include: {
      brand: { select: { name: true } },
      restaurant: { select: { name: true } },
      items: {
        include: { modifiers: true },
        orderBy: { sortOrder: "asc" },
      },
      payments: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  const outbox = order.externalOrderId
    ? await prisma.integrationOutbox.findUnique({
        where: { idempotencyKey: order.externalOrderId },
      })
    : null;

  return NextResponse.json({
    order: {
      id: order.id,
      reference: order.reference,
      status: order.status,
      acceptanceState: order.acceptanceState,
      preparationState: order.preparationState,
      paymentState: order.paymentState,
      fulfillmentState: order.fulfillmentState,
      fulfillmentType: order.fulfillmentType,
      brand: order.brand?.name ?? null,
      restaurant: order.restaurant.name,
      customerName: order.customerName,
      phone: order.phone,
      deliveryAddress: order.deliveryAddress,
      deliveryInstructions: order.deliveryInstructions,
      orderNote: order.orderNote,
      currency: order.currency,
      subtotal: order.subtotal,
      subtotalLabel: formatMAD(order.subtotal),
      deliveryFee: order.deliveryFee,
      deliveryFeeLabel: formatMAD(order.deliveryFee),
      total: order.total,
      totalLabel: formatMAD(order.total),
      priceChanged: order.priceChanged,
      externalOrderId: order.externalOrderId,
      posOrderId: order.posOrderId,
      acceptanceDeadlineAt: order.acceptanceDeadlineAt?.toISOString() ?? null,
      submittedAt: order.submittedAt?.toISOString() ?? null,
      acceptedAt: order.acceptedAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitPriceLabel: formatMAD(item.unitPrice),
        totalPrice: item.totalPrice,
        totalPriceLabel: formatMAD(item.totalPrice),
        notes: item.notes,
        modifiers: item.modifiers.map((mod) => ({
          group: mod.modifierGroupName,
          name: mod.modifierName,
          priceLabel: formatMAD(mod.unitPrice),
        })),
      })),
      payments: order.payments.map((payment) => ({
        method: payment.method,
        state: payment.state,
        amountLabel: formatMAD(payment.amount),
      })),
      timeline: order.events.map((event) => ({
        eventType: event.eventType,
        fromState: event.fromState,
        toState: event.toState,
        source: event.source,
        createdAt: event.createdAt.toISOString(),
      })),
      outbox: outbox
        ? {
            status: outbox.status,
            attempts: outbox.attempts,
            maxAttempts: outbox.maxAttempts,
            lastError: outbox.lastError,
            nextAttemptAt: outbox.nextAttemptAt?.toISOString() ?? null,
            processedAt: outbox.processedAt?.toISOString() ?? null,
          }
        : null,
    },
  });
}
