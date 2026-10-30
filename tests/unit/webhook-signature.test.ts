import { describe, expect, it } from "vitest";
import {
  signWebhookPayload,
  verifyWebhookSignature,
} from "@/lib/caisse212/webhooks";

const SECRET = "test-webhook-secret";

function signedBody(body: Record<string, unknown>, now: Date) {
  const raw = JSON.stringify(body);
  const timestamp = Math.floor(now.getTime() / 1000);
  return {
    raw,
    timestamp: String(timestamp),
    signature: signWebhookPayload(SECRET, raw, timestamp),
  };
}

describe("webhook signature verification", () => {
  it("accepts a valid signature", () => {
    const now = new Date();
    const { raw, timestamp, signature } = signedBody({ hello: "world" }, now);
    const error = verifyWebhookSignature({
      rawBody: raw,
      signature,
      timestamp,
      secret: SECRET,
      now,
    });
    expect(error).toBeNull();
  });

  it("rejects a wrong signature", () => {
    const now = new Date();
    const { raw, timestamp } = signedBody({ hello: "world" }, now);
    const error = verifyWebhookSignature({
      rawBody: raw,
      signature: "deadbeef",
      timestamp,
      secret: SECRET,
      now,
    });
    expect(error).toBe("Signature invalide");
  });

  it("rejects a stale timestamp", () => {
    const now = new Date();
    const old = new Date(now.getTime() - 10 * 60 * 1000);
    const { raw, timestamp, signature } = signedBody({ hello: "world" }, old);
    const error = verifyWebhookSignature({
      rawBody: raw,
      signature,
      timestamp,
      secret: SECRET,
      now,
    });
    expect(error).toContain("Horodatage");
  });

  it("rejects when the secret is missing", () => {
    const error = verifyWebhookSignature({
      rawBody: "{}",
      signature: "abc",
      timestamp: "1",
      secret: "",
      now: new Date(),
    });
    expect(error).toContain("non configuré");
  });
});
