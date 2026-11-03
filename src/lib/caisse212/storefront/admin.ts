import "server-only";
import { z } from "zod";
import { loadStorefrontCatalog } from "./catalog-source";
import { StorefrontError } from "./errors";
import {
  getFixtureMenuById,
  getFixtureRecordById,
  previewFixtureMenu,
  readFixtureState,
  writeFixtureState,
} from "./fixtures";
import { buildStorefrontIdMaps } from "./ids";
import { toAdminRecord } from "./menu-builder";
import {
  assertFixturesAllowed,
  getCaisse212BaseUrl,
  getPublicStorefrontBaseUrl,
  getStorefrontMode,
  type StorefrontAdminIntegrationStatus,
} from "./mode";
import {
  storefrontAdminPayloadSchema,
  storefrontAdminRecordSchema,
  storefrontMenuSchema,
} from "./schemas";
import type {
  StorefrontAdminPayload,
  StorefrontAdminRecord,
  StorefrontData,
  StorefrontMenuResponse,
} from "./types";
import { validateStorefrontPayload, type StorefrontIdSets } from "@/lib/storefront/validation";

/**
 * Storefront administration boundary.
 *
 * Live mode requires server-only integration credentials
 * (CAISSE212_ADMIN_TOKEN / CAISSE212_TENANT_ID / CAISSE212_BUSINESS_ID).
 * The V206 document does not define a login endpoint, so the website does not
 * invent one: without these credentials the admin area reports a clear
 * blocker instead of faking an authenticated session.
 *
 * Fixtures mode provides the same interface against the local fixture store
 * for development and demos.
 */

export function getAdminIntegrationStatus(): StorefrontAdminIntegrationStatus {
  const mode = getStorefrontMode();
  const missingVariables = [
    "CAISSE212_BASE_URL",
    "CAISSE212_ADMIN_TOKEN",
    "CAISSE212_TENANT_ID",
    "CAISSE212_BUSINESS_ID",
  ].filter((name) => !process.env[name]?.trim());
  return {
    mode,
    configured: missingVariables.length === 0,
    fixturesAvailable: mode === "fixtures" && process.env.NODE_ENV !== "production",
    baseUrl: getCaisse212BaseUrl(),
    missingVariables,
  };
}

// ---------------------------------------------------------------------------
// Fixtures CRUD
// ---------------------------------------------------------------------------

async function fixtureIdSets(): Promise<StorefrontIdSets> {
  const catalog = await loadStorefrontCatalog();
  const maps = buildStorefrontIdMaps(catalog);
  return {
    categoryIds: new Set(maps.categories.dbIdByNumeric.keys()),
    productIds: new Set(maps.products.dbIdByNumeric.keys()),
  };
}

/**
 * Fixtures validate ids against the local mirror. Live mode lets the backend
 * validate ids: the picker only offers real numeric external ids, and raw JSON
 * may legitimately reference ids the mirror has not synced yet.
 */
async function validationIdSets(): Promise<StorefrontIdSets | undefined> {
  return getStorefrontMode() === "fixtures" ? fixtureIdSets() : undefined;
}

async function validatePayload(
  payload: StorefrontAdminPayload,
  ids?: StorefrontIdSets,
): Promise<void> {
  const parsed = storefrontAdminPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new StorefrontError(
      "invalid_response",
      parsed.error.issues[0]?.message ?? "Données invalides",
      400,
    );
  }
  const result = validateStorefrontPayload(parsed.data as StorefrontAdminPayload, ids);
  if (!result.ok) {
    throw new StorefrontError("invalid_response", result.message ?? "Données invalides", 400);
  }
}

function slugTaken(
  records: Array<{ id: number; slug: string; deleted?: boolean }>,
  slug: string,
  exceptId?: number,
): boolean {
  return records.some(
    (record) => !record.deleted && record.slug === slug && record.id !== exceptId,
  );
}

async function listFixtureStorefronts(): Promise<StorefrontAdminRecord[]> {
  assertFixturesAllowed();
  const state = await readFixtureState();
  const base = getPublicStorefrontBaseUrl();
  const records = [...state.storefronts]
    .filter((record) => !record.deleted)
    .sort((a, b) => a.id - b.id);
  if (records.length === 0) {
    // Seed on first admin visit so the screen is usable immediately.
    const { ensureFixtureStorefront } = await import("./fixtures");
    const seeded = await ensureFixtureStorefront();
    return [toAdminRecord(seeded, base)];
  }
  return records.map((record) => toAdminRecord(record, base));
}

async function getFixtureAdminRecord(id: number): Promise<StorefrontAdminRecord> {
  const record = await getFixtureRecordById(id);
  return toAdminRecord(record, getPublicStorefrontBaseUrl());
}

async function createFixtureStorefront(
  payload: StorefrontAdminPayload,
): Promise<StorefrontAdminRecord> {
  assertFixturesAllowed();
  const ids = await validationIdSets();
  await validatePayload(payload, ids);
  const state = await readFixtureState();
  if (slugTaken(state.storefronts, payload.slug)) {
    throw new StorefrontError(
      "invalid_response",
      `Le slug « ${payload.slug} » est déjà utilisé`,
      400,
    );
  }
  const now = new Date().toISOString();
  const record = {
    id: state.nextId,
    slug: payload.slug,
    name: payload.name,
    businessId: payload.businessId ?? 1,
    allowedOrigins: payload.allowedOrigins,
    active: payload.active,
    version: 1,
    data: payload.data,
    createdAt: now,
    updatedAt: now,
  };
  state.storefronts.push(record);
  state.nextId += 1;
  await writeFixtureState(state);
  return toAdminRecord(record, getPublicStorefrontBaseUrl());
}

async function updateFixtureStorefront(
  id: number,
  payload: StorefrontAdminPayload,
): Promise<StorefrontAdminRecord> {
  assertFixturesAllowed();
  const ids = await validationIdSets();
  await validatePayload(payload, ids);
  const state = await readFixtureState();
  const record = state.storefronts.find((item) => item.id === id && !item.deleted);
  if (!record) throw new StorefrontError("not_found", "Site introuvable", 404);
  if (slugTaken(state.storefronts, payload.slug, id)) {
    throw new StorefrontError(
      "invalid_response",
      `Le slug « ${payload.slug} » est déjà utilisé`,
      400,
    );
  }
  if (payload.businessId !== undefined && payload.businessId !== record.businessId) {
    throw new StorefrontError(
      "invalid_response",
      "Le business d'un site ne peut pas être modifié",
      400,
    );
  }
  record.slug = payload.slug;
  record.name = payload.name;
  record.allowedOrigins = payload.allowedOrigins;
  record.active = payload.active;
  record.data = payload.data;
  record.version += 1;
  record.updatedAt = new Date().toISOString();
  await writeFixtureState(state);
  return toAdminRecord(record, getPublicStorefrontBaseUrl());
}

async function deleteFixtureStorefront(id: number): Promise<void> {
  assertFixturesAllowed();
  const state = await readFixtureState();
  const record = state.storefronts.find((item) => item.id === id && !item.deleted);
  if (!record) throw new StorefrontError("not_found", "Site introuvable", 404);
  record.deleted = true;
  record.updatedAt = new Date().toISOString();
  await writeFixtureState(state);
}

// ---------------------------------------------------------------------------
// Live admin client
// ---------------------------------------------------------------------------

function requireAdminCredentials(): {
  baseUrl: string;
  token: string;
  tenantId: string;
  businessId: string;
} {
  const status = getAdminIntegrationStatus();
  if (!status.configured) {
    throw new StorefrontError(
      "not_configured",
      `Intégration admin Caisse212 non configurée. Variables manquantes : ${status.missingVariables.join(", ")}`,
      503,
    );
  }
  return {
    baseUrl: getCaisse212BaseUrl(),
    token: process.env.CAISSE212_ADMIN_TOKEN!.trim(),
    tenantId: process.env.CAISSE212_TENANT_ID!.trim(),
    businessId: process.env.CAISSE212_BUSINESS_ID!.trim(),
  };
}

async function adminRequest(path: string, init?: RequestInit): Promise<unknown> {
  const credentials = requireAdminCredentials();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${credentials.baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.token}`,
        "X-Tenant-Id": credentials.tenantId,
        "X-Business-Id": credentials.businessId,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });

    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      const message =
        (json as { message?: string } | null)?.message ||
        `Erreur Caisse212 (${response.status})`;
      throw new StorefrontError(
        response.status === 404 ? "not_found" : "upstream_error",
        message,
        response.status,
      );
    }
    return json;
  } catch (error) {
    if (error instanceof StorefrontError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new StorefrontError("timeout", "Caisse212 n'a pas répondu dans les délais", 504);
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

function normalizeLiveRecord(
  record: z.infer<typeof storefrontAdminRecordSchema>,
): StorefrontAdminRecord {
  return {
    ...record,
    publicUrl:
      record.publicUrl ?? `${getPublicStorefrontBaseUrl()}/${record.slug}`,
  };
}

async function listLiveStorefronts(): Promise<StorefrontAdminRecord[]> {
  const payload = await adminRequest("/api/storefronts");
  return z.array(storefrontAdminRecordSchema).parse(payload).map(normalizeLiveRecord);
}

async function getLiveStorefront(id: number): Promise<StorefrontAdminRecord> {
  const payload = await adminRequest(`/api/storefronts/${id}`);
  return normalizeLiveRecord(storefrontAdminRecordSchema.parse(payload));
}

async function createLiveStorefront(
  payload: StorefrontAdminPayload,
): Promise<StorefrontAdminRecord> {
  const response = await adminRequest("/api/storefronts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeLiveRecord(storefrontAdminRecordSchema.parse(response));
}

async function updateLiveStorefront(
  id: number,
  payload: StorefrontAdminPayload,
): Promise<StorefrontAdminRecord> {
  const response = await adminRequest(`/api/storefronts/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return normalizeLiveRecord(storefrontAdminRecordSchema.parse(response));
}

async function deleteLiveStorefront(id: number): Promise<void> {
  await adminRequest(`/api/storefronts/${id}`, { method: "DELETE" });
}

async function getLiveMenu(id: number): Promise<StorefrontMenuResponse> {
  const payload = await adminRequest(`/api/storefronts/${id}/menu`);
  return storefrontMenuSchema.parse(payload);
}

async function previewLiveMenu(
  id: number,
  data: StorefrontData,
): Promise<StorefrontMenuResponse> {
  const payload = await adminRequest(`/api/storefronts/${id}/menu/preview`, {
    method: "POST",
    body: JSON.stringify({ data }),
  });
  return storefrontMenuSchema.parse(payload);
}

// ---------------------------------------------------------------------------
// Unified service
// ---------------------------------------------------------------------------

function assertModeReady(): "fixtures" | "live" {
  const mode = getStorefrontMode();
  if (mode === "off") {
    throw new StorefrontError(
      "not_configured",
      "Le module Sites web est désactivé (CAISSE212_STOREFRONT_MODE=off).",
      503,
    );
  }
  return mode;
}

export const storefrontAdmin = {
  async list(): Promise<StorefrontAdminRecord[]> {
    return assertModeReady() === "fixtures" ? listFixtureStorefronts() : listLiveStorefronts();
  },

  async get(id: number): Promise<StorefrontAdminRecord> {
    return assertModeReady() === "fixtures" ? getFixtureAdminRecord(id) : getLiveStorefront(id);
  },

  async create(payload: StorefrontAdminPayload): Promise<StorefrontAdminRecord> {
    if (assertModeReady() === "fixtures") {
      return createFixtureStorefront(payload);
    }
    const ids = await validationIdSets();
    await validatePayload(payload, ids);
    return createLiveStorefront(payload);
  },

  async update(id: number, payload: StorefrontAdminPayload): Promise<StorefrontAdminRecord> {
    if (assertModeReady() === "fixtures") {
      return updateFixtureStorefront(id, payload);
    }
    const ids = await validationIdSets();
    await validatePayload(payload, ids);
    return updateLiveStorefront(id, payload);
  },

  async delete(id: number): Promise<void> {
    return assertModeReady() === "fixtures"
      ? deleteFixtureStorefront(id)
      : deleteLiveStorefront(id);
  },

  async getMenu(id: number): Promise<StorefrontMenuResponse> {
    return assertModeReady() === "fixtures" ? getFixtureMenuById(id) : getLiveMenu(id);
  },

  async previewMenu(id: number, data: StorefrontData): Promise<StorefrontMenuResponse> {
    if (assertModeReady() === "fixtures") {
      const result = validateStorefrontPayload(
        { slug: "preview", name: "preview", allowedOrigins: [], active: true, data },
        await fixtureIdSets(),
      );
      if (!result.ok) {
        throw new StorefrontError("invalid_response", result.message ?? "Données invalides", 400);
      }
      return previewFixtureMenu(id, data);
    }
    return previewLiveMenu(id, data);
  },
};
