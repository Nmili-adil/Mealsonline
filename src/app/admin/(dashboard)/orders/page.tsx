import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { formatMAD } from "@/lib/money";

export const metadata: Metadata = { title: "Commandes" };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await prisma.onlineOrder.findMany({
    include: {
      brand: { select: { name: true } },
      items: { select: { quantity: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <OrdersTable
      orders={orders.map((order) => ({
        id: order.id,
        reference: order.reference,
        status: order.status,
        acceptanceState: order.acceptanceState,
        preparationState: order.preparationState,
        paymentState: order.paymentState,
        fulfillmentState: order.fulfillmentState,
        fulfillmentType: order.fulfillmentType,
        brand: order.brand?.name ?? null,
        customerName: order.customerName,
        phone: order.phone,
        totalLabel: formatMAD(order.total),
        posOrderId: order.posOrderId,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: order.createdAt.toISOString(),
      }))}
    />
  );
}
