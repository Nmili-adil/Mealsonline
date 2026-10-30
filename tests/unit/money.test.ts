import { describe, expect, it } from "vitest";
import { fromMinor, formatMAD, multiplyMinor, sumMinor, toMinor } from "@/lib/money";

describe("money helpers", () => {
  it("converts major units to minor units without floating point drift", () => {
    expect(toMinor(49)).toBe(4900);
    expect(toMinor(0.1)).toBe(10);
    expect(toMinor(10.99)).toBe(1099);
  });

  it("converts minor units back to major units", () => {
    expect(fromMinor(4900)).toBe(49);
    expect(fromMinor(1099)).toBe(10.99);
  });

  it("sums minor units", () => {
    expect(sumMinor([2900, 800, 1500])).toBe(5200);
  });

  it("multiplies without drift", () => {
    expect(multiplyMinor(2900, 3)).toBe(8700);
  });

  it("formats MAD", () => {
    expect(formatMAD(4900)).toContain("49");
    expect(formatMAD(0)).toContain("0");
  });
});
