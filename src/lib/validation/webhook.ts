import { z } from "zod";
import { WEBHOOK_EVENT_TYPES } from "@/lib/constants";

/**
 * Proposed Caisse212 webhook payload. Logical event names; must be mapped to
 * the real POS contract when confirmed (docs/CAISSE212_API_CONTRACT.md).
 */
export const webhookEventSchema = z.object({
  id: z.string().min(1).max(200), // unique POS event ID (deduplication)
  type: z.enum(WEBHOOK_EVENT_TYPES),
  timestamp: z.string().datetime(),
  data: z.object({
    externalOrderId: z.string().min(1),
    posOrderId: z.string().optional(),
    reason: z.string().optional(),
  }),
});

export type WebhookEventPayload = z.infer<typeof webhookEventSchema>;
