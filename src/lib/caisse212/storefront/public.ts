import "server-only";
import { StorefrontError } from "./errors";
import { getFixtureConfig, getFixtureMenu, getFixtureProductDetail } from "./fixtures";
import { getCaisse212BaseUrl, getStorefrontMode, getStorefrontSlug } from "./mode";
import {
  storefrontConfigSchema,
  storefrontMenuSchema,
  storefrontProductDetailSchema,
} from "./schemas";
import type {
  StorefrontConfigResponse,
  StorefrontMenuResponse,
  StorefrontProductDetail,
} from "./types";

/**
 * Public Storefront V206 client (server-side only).
 *
 * - mode=live     → real unauthenticated Caisse212 endpoints
 * - mode=fixtures → local fixture store (clearly labelled, dev only)
 * - mode=off      → null (the legacy DB-driven website is used)
 *
 * Freshness policy:
 *  - configuration: no-store (a save must be visible on the next request)
 *  - menu: revalidate 60 s (catalog changes visible within ~1 minute)
 *  - product detail: revalidate 60 s
 */

const TIMEOUT_MS = 8_000;

async function publicRequest(
  path: string,
  revalidate: number | false,
): Promise<unknown | null> {
  const base = getCaisse212BaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${path}`, {
      signal: controller.signal,
      cache: revalidate === false ? "no-store" : undefined,
      next: revalidate === false ? undefined : { revalidate },
      headers: { Accept: "application/json" },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      let message = `Caisse212 Storefront a répondu ${response.status}`;
      try {
        const payload = (await response.json()) as { message?: string };
        if (payload?.message) message = payload.message;
      } catch {
        // keep the generic message
      }
      throw new StorefrontError("upstream_error", message, response.status);
    }

    const text = await response.text();
    if (!text) {
      throw new StorefrontError("invalid_response", "Réponse Storefront vide", 502);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new StorefrontError("invalid_response", "Réponse Storefront invalide", 502);
    }
  } catch (error) {
    if (error instanceof StorefrontError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new StorefrontError("timeout", "Caisse212 Storefront n'a pas répondu dans les délais", 504);
    }
    throw new StorefrontError(
      "upstream_error",
      error instanceof Error ? error.message : "Erreur réseau Caisse212",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

function parseOrThrow<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string; path: Array<string | number> }> } } },
  payload: unknown,
  label: string,
): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new StorefrontError(
      "invalid_response",
      `Réponse ${label} invalide${issue ? ` : ${issue.path.join(".")} ${issue.message}` : ""}`,
      502,
      parsed.error.issues,
    );
  }
  return parsed.data;
}

export async function getPublicStorefrontConfig(
  slug: string,
): Promise<StorefrontConfigResponse | null> {
  const mode = getStorefrontMode();
  if (mode === "off") return null;
  if (mode === "fixtures") return getFixtureConfig(slug);

  const payload = await publicRequest(
    `/api/public/storefront/${encodeURIComponent(slug)}`,
    false,
  );
  if (payload === null) return null;
  return parseOrThrow(storefrontConfigSchema, payload, "de configuration");
}

export async function getPublicStorefrontMenu(
  slug: string,
): Promise<StorefrontMenuResponse | null> {
  const mode = getStorefrontMode();
  if (mode === "off") return null;
  if (mode === "fixtures") return getFixtureMenu(slug);

  const payload = await publicRequest(
    `/api/public/storefront/${encodeURIComponent(slug)}/menu`,
    60,
  );
  if (payload === null) return null;
  return parseOrThrow(storefrontMenuSchema, payload, "de menu");
}

export async function getPublicStorefrontProduct(
  menuCode: string,
  productId: number,
): Promise<StorefrontProductDetail | null> {
  const mode = getStorefrontMode();
  if (mode === "off") return null;
  if (mode === "fixtures") return getFixtureProductDetail(menuCode, productId);

  const payload = await publicRequest(
    `/api/public/menu/${encodeURIComponent(menuCode)}/products/${productId}`,
    60,
  );
  if (payload === null) return null;
  return parseOrThrow(storefrontProductDetailSchema, payload, "de produit");
}

/** Config for the slug configured for this deployment (public pages). */
export async function getConfiguredStorefrontConfig(): Promise<StorefrontConfigResponse | null> {
  return getPublicStorefrontConfig(getStorefrontSlug());
}

export async function getConfiguredStorefrontMenu(): Promise<StorefrontMenuResponse | null> {
  return getPublicStorefrontMenu(getStorefrontSlug());
}

export async function getConfiguredStorefrontProduct(
  menuCode: string,
  productId: number,
): Promise<StorefrontProductDetail | null> {
  return getPublicStorefrontProduct(menuCode, productId);
}
