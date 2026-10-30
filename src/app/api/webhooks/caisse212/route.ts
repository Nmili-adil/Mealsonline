import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/caisse212/webhooks";
import { webhookEventSchema } from "@/lib/validation/webhook";
import { processWebhookEvent } from "@/lib/webhooks/processor";

export const dynamic = "force-dynamic";

/**
 * Caisse212 order-event webhook receiver.
 *
 * Security:
 *  - HMAC-SHA256 over the raw body (`x-caisse212-signature`).
 *  - Timestamp freshness (`x-caisse212-timestamp`, ±5 minutes).
 *  - Payload validation with Zod.
 *  - Deduplication by external event ID (IntegrationInbox unique).
 *  - Allowed status transitions only.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("x-caisse212-signature");
  const timestamp = request.headers.get("x-caisse212-timestamp");
  const rawBody = await request.text();

  const secret = process.env.CAISSE212_WEBHOOK_SECRET ?? "";
  const signatureError = verifyWebhookSignature({
    rawBody,
    signature,
    timestamp,
    secret,
  });
  if (signatureError) {
    return NextResponse.json({ error: signatureError }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = webhookEventSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload invalide", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await processWebhookEvent(parsed.data);
  switch (result.status) {
    case "processed":
    case "duplicate":
      return NextResponse.json({ received: true, status: result.status });
    case "order_not_found":
      return NextResponse.json({ received: true, status: "order_not_found" }, { status: 202 });
    case "invalid_transition":
      return NextResponse.json(
        { received: true, status: "invalid_transition", message: result.message },
        { status: 409 },
      );
  }
}
