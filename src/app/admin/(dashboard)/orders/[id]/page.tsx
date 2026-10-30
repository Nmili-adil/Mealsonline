import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OrderDetail } from "@/components/admin/OrderDetail";
import { formatMAD } from "@/lib/money";

export const metadata: Metadata = { title: "Détail de commande" };
export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.onlineOrder.findUnique({
    where: { id },
    include: {
      brand: { select: { name: true } },
      restaurant: { select: { name: true } },
      items: { include: { modifiers: true }, orderBy: { sortOrder: "asc" } },
      payments: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const outbox = order.externalOrderId
    ? await prisma.integrationOutbox.findUnique({
        where: { idempotencyKey: order.externalOrderId },
      })
    : null;

  return (
    <OrderDetail
      order={{
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
        subtotalLabel: formatMAD(order.subtotal),
        deliveryFeeLabel: formatMAD(order.deliveryFee),
        totalLabel: formatMAD(order.total),
        priceChanged: order.priceChanged,
        externalOrderId: order.externalOrderId,
        posOrderId: order.posOrderId,
        acceptanceDeadlineAt: order.acceptanceDeadlineAt?.toISOString() ?? null,
        submittedAt: order.submittedAt?.toISOString() ?? null,
        acceptedAt: order.acceptedAt?.toISOString() ?? null,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          name: item.name,
          variantName: item.variantName,
          quantity: item.quantity,
          unitPriceLabel: formatMAD(item.unitPrice),
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
      }}
    />
  );
}
