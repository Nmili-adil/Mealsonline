import "server-only";
import { StorefrontError } from "./errors";

export type StorefrontMode = "off" | "fixtures" | "live";

/**
 * CAISSE212_STOREFRONT_MODE
 *   off      — feature disabled; the legacy DB-driven menu is used
 *   fixtures — local storefront fixtures, clearly labelled, never in prod
 *   live     — real Storefront V206 public/admin endpoints
 */
export function getStorefrontMode(): StorefrontMode {
  const raw = (process.env.CAISSE212_STOREFRONT_MODE || "off").trim().toLowerCase();
  if (raw === "fixtures" || raw === "live") return raw;
  return "off";
}

export function isStorefrontEnabled(): boolean {
  return getStorefrontMode() !== "off";
}

export function assertFixturesAllowed(): void {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CAISSE212_ALLOW_STOREFRONT_FIXTURES_IN_PROD !== "true"
  ) {
    throw new StorefrontError(
      "fixtures_forbidden",
      "Le mode fixtures Storefront est interdit en production. Configurez CAISSE212_STOREFRONT_MODE=live.",
      503,
    );
  }
}

export function getStorefrontSlug(): string {
  return process.env.CAISSE212_STOREFRONT_SLUG?.trim() || "mealsonline";
}

export function getCaisse212BaseUrl(): string {
  return (process.env.CAISSE212_BASE_URL?.trim() || "https://app.caisse212.com").replace(
    /\/$/,
    "",
  );
}

/** Public API base URL shown in the admin (documented public path). */
export function getPublicStorefrontBaseUrl(): string {
  return `${getCaisse212BaseUrl()}/api/public/storefront`;
}

export function getBusinessId(): number | undefined {
  const raw = process.env.CAISSE212_BUSINESS_ID;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export interface StorefrontAdminIntegrationStatus {
  mode: StorefrontMode;
  /** True when live admin calls can be made with the configured credentials. */
  configured: boolean;
  /** True when the admin can operate on local fixtures instead. */
  fixturesAvailable: boolean;
  baseUrl: string;
  missingVariables: string[];
}
