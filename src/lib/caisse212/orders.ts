import "server-only";
import { getCaisse212Provider } from "./client";
import type {
  ExternalOrderStatus,
  SubmitOrderInput,
  SubmitOrderResult,
} from "./types";

/**
 * Order operations against Caisse212. The website never calls Caisse212 from
 * the browser; checkout creates a durable outbox event and the worker calls
 * these functions.
 */

export async function submitOrderToCaisse212(
  input: SubmitOrderInput,
): Promise<SubmitOrderResult> {
  const provider = getCaisse212Provider();
  return provider.submitOrder(input);
}

export async function lookupOrderByExternalId(
  externalOrderId: string,
): Promise<ExternalOrderStatus | null> {
  const provider = getCaisse212Provider();
  return provider.getOrderByExternalId(externalOrderId);
}

export async function lookupOrderByPosId(
  posOrderId: string,
): Promise<ExternalOrderStatus | null> {
  const provider = getCaisse212Provider();
  return provider.getOrderStatus(posOrderId);
}
