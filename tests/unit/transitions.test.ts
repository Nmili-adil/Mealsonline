import { describe, expect, it } from "vitest";
import {
  computeOrderStatus,
  eventEffect,
  isTransitionAllowed,
} from "@/lib/orders/transitions";

const baseOrder = {
  status: "pending_submission",
  acceptanceState: "pending",
  preparationState: "pending",
  paymentState: "pending",
  fulfillmentState: "pending",
};

describe("status transitions", () => {
  it("allows pending acceptance -> accepted", () => {
    const effect = eventEffect("order.accepted", baseOrder);
    expect(effect.error).toBeUndefined();
    expect(effect.updates.acceptanceState).toBe("accepted");
  });

  it("rejects an invalid transition (rejected after accepted)", () => {
    const accepted = { ...baseOrder, acceptanceState: "accepted", status: "accepted" };
    const effect = eventEffect("order.rejected", accepted);
    expect(effect.error).toContain("invalide");
  });

  it("treats duplicate accepted events as idempotent", () => {
    const accepted = { ...baseOrder, acceptanceState: "accepted", status: "accepted" };
    const effect = eventEffect("order.accepted", accepted);
    expect(effect.error).toBeUndefined();
    expect(effect.updates.acceptanceState).toBe("accepted");
  });

  it("derives the single display status from the four dimensions", () => {
    expect(computeOrderStatus("accepted", "preparing", "pending", "pending")).toBe("preparing");
    expect(computeOrderStatus("accepted", "ready", "pending", "pending")).toBe("ready");
    expect(computeOrderStatus("pending", "pending", "pending", "pending")).toBe(
      "pending_submission",
    );
    expect(computeOrderStatus("rejected", "pending", "pending", "cancelled")).toBe("rejected");
  });

  it("validates transition rules", () => {
    expect(isTransitionAllowed("preparation", "pending", "preparing")).toBe(true);
    expect(isTransitionAllowed("preparation", "preparing", "ready")).toBe(true);
    expect(isTransitionAllowed("preparation", "preparing", "delivered")).toBe(false);
  });
});
