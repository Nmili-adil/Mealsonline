import { describe, expect, it } from "vitest";
import { canManageStorefronts } from "@/lib/caisse212/storefront/roles";

describe("storefront admin roles", () => {
  it("allows ADMIN and SUPER_ADMIN (including separator variants)", () => {
    expect(canManageStorefronts("admin")).toBe(true);
    expect(canManageStorefronts("ADMIN")).toBe(true);
    expect(canManageStorefronts("super_admin")).toBe(true);
    expect(canManageStorefronts("super-admin")).toBe(true);
    expect(canManageStorefronts("superadmin")).toBe(true);
  });

  it("rejects operators and anonymous sessions", () => {
    expect(canManageStorefronts("operator")).toBe(false);
    expect(canManageStorefronts("editor")).toBe(false);
    expect(canManageStorefronts(null)).toBe(false);
    expect(canManageStorefronts(undefined)).toBe(false);
    expect(canManageStorefronts("")).toBe(false);
  });
});
