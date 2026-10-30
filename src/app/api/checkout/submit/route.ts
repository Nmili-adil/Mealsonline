import { NextRequest, NextResponse } from "next/server";
import { checkoutSubmitSchema } from "@/lib/validation/schemas";
import { createPendingOrder } from "@/lib/orders/create-order";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON invalide" }, { status: 400 });
  }

  const parsed = checkoutSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_input",
        message: parsed.error.issues[0]?.message ?? "Données invalides",
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (input.fulfillmentType === "delivery" && !input.deliveryAddress?.trim()) {
    return NextResponse.json(
      { ok: false, code: "invalid_input", message: "L'adresse de livraison est requise" },
      { status: 400 },
    );
  }

  const result = await createPendingOrder(input);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        message: result.message,
        total: result.total,
        requiresApproval: result.requiresApproval,
      },
      { status: result.requiresApproval ? 409 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    orderId: result.orderId,
    reference: result.reference,
    trackingToken: result.trackingToken,
    status: result.status,
  });
}
