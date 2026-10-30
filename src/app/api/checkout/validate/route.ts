import { NextRequest, NextResponse } from "next/server";
import { checkoutValidateSchema } from "@/lib/validation/schemas";
import { validateCartAgainstCatalog } from "@/lib/orders/validate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON invalide" }, { status: 400 });
  }

  const parsed = checkoutValidateSchema.safeParse(body);
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

  const result = await validateCartAgainstCatalog(input);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.code === "product_unavailable" ? 409 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    subtotal: result.subtotal,
    deliveryFee: result.deliveryFee,
    total: result.total,
    currency: result.currency,
    priceChanged: result.priceChanged,
    lines: result.lines.map((line) => ({
      productId: line.productId,
      name: line.productName,
      variantName: line.variantName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    })),
  });
}
