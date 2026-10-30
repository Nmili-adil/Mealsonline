import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth/guard";
import { formatMAD } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const status = request.nextUrl.searchParams.get("status") ?? "";
  const orders = await prisma.onlineOrder.findMany({
    where: status ? { status } : {},
    include: {
      brand: { select: { name: true } },
      items: { select: { name: true, quantity: true, totalPrice: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
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
      total: order.total,
      totalLabel: formatMAD(order.total),
      posOrderId: order.posOrderId,
      externalOrderId: order.externalOrderId,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt.toISOString(),
    })),
  });
}
