import { NextResponse } from "next/server";
import { getPublicOrder } from "@/lib/orders/tracking";
import { TRACKING_HEADER_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ reference: string }> },
) {
  const { reference } = await ctx.params;
  const token =
    request.headers.get(TRACKING_HEADER_NAME) ??
    new URL(request.url).searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Jeton de suivi manquant" }, { status: 401 });
  }

  const order = await getPublicOrder(decodeURIComponent(reference), token);
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  return NextResponse.json(order);
}
