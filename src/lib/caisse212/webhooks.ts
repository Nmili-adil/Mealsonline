import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Verify a Caisse212 webhook request:
 *  - HMAC-SHA256 over the RAW body (hex digest in `x-caisse212-signature`).
 *  - Timestamp freshness (`x-caisse212-timestamp`, unix seconds).
 *
 * Returns an error message when verification fails, otherwise null.
 */
export function verifyWebhookSignature(params: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  now?: Date;
}): string | null {
  const { rawBody, signature, timestamp, secret, now = new Date() } = params;

  if (!secret) return "CAISSE212_WEBHOOK_SECRET non configuré";
  if (!signature) return "Signature manquante";
  if (!timestamp) return "Horodatage manquant";

  const unixSeconds = Number(timestamp);
  if (!Number.isFinite(unixSeconds)) return "Horodatage invalide";
  const ageSeconds = Math.abs(now.getTime() / 1000 - unixSeconds);
  if (ageSeconds > WEBHOOK_TOLERANCE_SECONDS) {
    return `Horodatage hors fenêtre (${Math.round(ageSeconds)}s)`;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.toLowerCase();
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return "Signature invalide";
  }
  return null;
}

export function signWebhookPayload(secret: string, rawBody: string, timestamp: number): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}
