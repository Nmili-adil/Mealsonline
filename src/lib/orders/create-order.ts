import "server-only";
import { prisma } from "@/lib/prisma";
import { randomToken } from "@/lib/crypto";
import { generateReference } from "@/lib/utils";
import { ACCEPTANCE_TIMEOUT_SECONDS } from "@/lib/constants";
import type { CheckoutSubmitInput } from "@/lib/validation/schemas";
import { validateCartAgainstCatalog } from "./validate";
import type { SubmitOrderInput } from "@/lib/caisse212/types";

export type CreateOrderResult =
  | {
      ok: true;
      orderId: string;
      reference: string;
      trackingToken: string;
      status: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
      total?: number;
      requiresApproval?: boolean;
    };

/**
 * Durable checkout persistence.
 *
 *  1. Revalidates the cart against the catalog (prices are NEVER trusted
 *     from the browser).
 *  2. Requires the client-approved total to match the server total exactly.
 *  3. Creates the pending order + payment + outbox event in ONE transaction.
 */
export async function createPendingOrder(
  input: CheckoutSubmitInput,
): Promise<CreateOrderResult> {
  const validation = await validateCartAgainstCatalog(input, input.approvedTotal);

  if (!validation.ok) {
    return { ok: false, code: validation.code, message: validation.message };
  }

  if (validation.total !== input.approvedTotal) {
    return {
      ok: false,
      code: "price_changed",
      message: "Le montant a changé. Merci de confirmer le nouveau total.",
      total: validation.total,
      requiresApproval: true,
    };
  }

  const restaurant = await prisma.restaurant.findFirstOrThrow({
    where: { slug: "mealsonline" },
  });
  const externalOrderId = `EXT-${randomToken(16)}`;
  const reference = await uniqueReference();
  const trackingToken = randomToken(32);
  const acceptanceDeadlineAt = new Date(
    Date.now() + ACCEPTANCE_TIMEOUT_SECONDS * 1000,
  );

  const submitInput: SubmitOrderInput = {
    externalOrderId,
    brandExternalId: validation.brandId
      ? (await prisma.brand.findUnique({ where: { id: validation.brandId } }))?.externalId ?? undefined
      : undefined,
    fulfillmentType: input.fulfillmentType,
    customer: { name: input.customerName, phone: input.phone },
    delivery:
      input.fulfillmentType === "delivery"
        ? {
            address: input.deliveryAddress,
            instructions: input.deliveryInstructions,
          }
        : undefined,
    orderNote: input.orderNote,
    paymentMethod: input.paymentMethod,
    currency: validation.currency,
    // The POS prices order lines only; the website adds delivery fees on top.
    expectedTotal: validation.subtotal,
    acceptRepricing: input.approvePriceChange,
    lines: validation.lines.map((line) => ({
      externalProductId: line.externalProductId ?? line.productId,
      externalVariantId: line.externalVariantId ?? line.variantId,
      quantity: line.quantity,
      externalModifierIds: line.externalModifierIds,
      notes: line.notes,
      unitPrice: line.unitPrice,
    })),
  };

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.onlineOrder.create({
      data: {
        restaurantId: restaurant.id,
        brandId: validation.brandId,
        reference,
        trackingToken,
        externalOrderId,
        fulfillmentType: input.fulfillmentType,
        status: "pending_submission",
        acceptanceState: "pending",
        preparationState: "pending",
        paymentState: "pending",
        fulfillmentState: "pending",
        customerName: input.customerName,
        phone: input.phone,
        deliveryAddress: input.fulfillmentType === "delivery" ? input.deliveryAddress : null,
        deliveryInstructions: input.deliveryInstructions ?? null,
        orderNote: input.orderNote ?? null,
        currency: validation.currency,
        subtotal: validation.subtotal,
        deliveryFee: validation.deliveryFee,
        total: validation.total,
        priceChanged: validation.priceChanged,
        amountsAuthorized: true,
        acceptanceDeadlineAt,
      },
    });

    for (let index = 0; index < validation.lines.length; index += 1) {
      const line = validation.lines[index];
      const orderItem = await tx.onlineOrderItem.create({
        data: {
          orderId: created.id,
          productId: line.productId,
          externalProductId: line.externalProductId,
          name: line.productName,
          variantId: line.variantId,
          externalVariantId: line.externalVariantId,
          variantName: line.variantName,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          totalPrice: line.lineTotal,
          notes: line.notes ?? null,
          sortOrder: index,
        },
      });
      for (const modifier of line.modifiers) {
        await tx.onlineOrderItemModifier.create({
          data: {
            orderItemId: orderItem.id,
            externalModifierId: modifier.externalModifierId,
            modifierGroupName: modifier.groupName,
            modifierName: modifier.name,
            unitPrice: modifier.unitPrice,
            quantity: line.quantity,
          },
        });
      }
    }

    await tx.orderPayment.create({
      data: {
        orderId: created.id,
        method: input.paymentMethod,
        state: "pending",
        amount: validation.total,
      },
    });

    await tx.orderStatusEvent.create({
      data: {
        orderId: created.id,
        eventType: "order.created",
        fromState: null,
        toState: "pending_submission",
        source: "system",
      },
    });

    await tx.integrationOutbox.create({
      data: {
        eventType: "order.submit",
        payload: JSON.stringify(submitInput),
        idempotencyKey: externalOrderId,
        status: "pending",
        maxAttempts: 8,
        nextAttemptAt: new Date(),
        correlationId: externalOrderId,
      },
    });

    return created;
  });

  return {
    ok: true,
    orderId: order.id,
    reference: order.reference,
    trackingToken,
    status: order.status,
  };
}

async function uniqueReference(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const reference = generateReference();
    const existing = await prisma.onlineOrder.findUnique({ where: { reference } });
    if (!existing) return reference;
  }
  return generateReference();
}
