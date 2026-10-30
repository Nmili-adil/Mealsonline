import "server-only";
import { randomUUID } from "node:crypto";
import {
  Caisse212Error,
  type Caisse212Provider,
  type ExternalOrderStatus,
  type SubmitOrderInput,
  type SubmitOrderResult,
  type CatalogSnapshot,
  type CatalogChanges,
  type AvailabilitySnapshot,
} from "./types";
import { MockCaisse212Provider } from "./mock";
import {
  catalogSnapshotSchema,
  catalogChangesSchema,
  availabilitySnapshotSchema,
  submitOrderResultSchema,
  externalOrderStatusSchema,
} from "./schemas";

/**
 * Provider factory. Reads CAISSE212_MODE once per process and returns a
 * singleton provider. Live mode FAILS CLOSED unless all required credentials
 * are present. Mock mode is refused in production builds.
 */

export type Caisse212Mode = "mock" | "live";

export function getCaisse212Mode(): Caisse212Mode {
  const mode = (process.env.CAISSE212_MODE ?? "mock").toLowerCase();
  if (mode !== "mock" && mode !== "live") {
    throw new Caisse212Error(
      "not_configured",
      `CAISSE212_MODE invalide: ${mode} (attendu: mock | live)`,
    );
  }
  return mode;
}

let cachedProvider: Caisse212Provider | null = null;

export function getCaisse212Provider(): Caisse212Provider {
  if (cachedProvider) return cachedProvider;
  const mode = getCaisse212Mode();

  if (mode === "mock") {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.CAISSE212_ALLOW_MOCK_IN_PROD !== "true"
    ) {
      throw new Caisse212Error(
        "not_configured",
        "Le mode mock Caisse212 est interdit en production. Configurez CAISSE212_MODE=live et les identifiants.",
      );
    }
    cachedProvider = new MockCaisse212Provider();
    return cachedProvider;
  }

  const missing = [
    "CAISSE212_BASE_URL",
    "CAISSE212_CLIENT_ID",
    "CAISSE212_CLIENT_SECRET",
  ].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Caisse212Error(
      "not_configured",
      `Intégration Caisse212 live incomplète — variables manquantes: ${missing.join(", ")}`,
    );
  }
  cachedProvider = new LiveCaisse212Provider(
    process.env.CAISSE212_BASE_URL!,
    process.env.CAISSE212_CLIENT_ID!,
    process.env.CAISSE212_CLIENT_SECRET!,
  );
  return cachedProvider;
}

export interface IntegrationHealth {
  mode: Caisse212Mode;
  available: boolean;
  configured: boolean;
  missingVariables: string[];
  webhookSecretConfigured: boolean;
  baseUrlSet: boolean;
}

export function getIntegrationHealth(): IntegrationHealth {
  const mode = getCaisse212Mode();
  const required = [
    "CAISSE212_BASE_URL",
    "CAISSE212_CLIENT_ID",
    "CAISSE212_CLIENT_SECRET",
  ];
  const missingVariables = required.filter((name) => !process.env[name]);
  let available = true;
  try {
    getCaisse212Provider();
  } catch {
    available = false;
  }
  return {
    mode,
    available,
    configured: missingVariables.length === 0,
    missingVariables,
    webhookSecretConfigured: Boolean(process.env.CAISSE212_WEBHOOK_SECRET),
    baseUrlSet: Boolean(process.env.CAISSE212_BASE_URL),
  };
}

// ---------------------------------------------------------------------------
// Live HTTP provider (proposed endpoints — see docs/CAISSE212_API_CONTRACT.md)
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 12_000;

interface LiveRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
  correlationId?: string;
}

class LiveCaisse212Provider implements Caisse212Provider {
  constructor(
    private readonly baseUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  private async request<T>(
    path: string,
    options: LiveRequestOptions,
    schema: { parse(data: unknown): T },
  ): Promise<T> {
    const correlationId = options.correlationId ?? randomUUID();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
        method: options.method ?? "GET",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.clientId}:${this.clientSecret}`,
          "x-correlation-id": correlationId,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Caisse212Error("auth_failed", `Authentification Caisse212 refusée (${response.status})`, { correlationId });
        }
        if (response.status === 422) {
          throw new Caisse212Error("validation", "Caisse212 a rejeté la requête (validation)", { correlationId });
        }
        if (response.status >= 500) {
          throw new Caisse212Error("unavailable", `Caisse212 indisponible (${response.status})`, { correlationId, retryable: true });
        }
        throw new Caisse212Error("unexpected", `Réponse Caisse212 inattendue (${response.status})`, { correlationId });
      }
      const raw = await response.json();
      try {
        return schema.parse(raw);
      } catch (error) {
        throw new Caisse212Error("unexpected", "Réponse Caisse212 invalide (schéma)", {
          correlationId,
          cause: error,
        });
      }
    } catch (error) {
      if (error instanceof Caisse212Error) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new Caisse212Error("timeout", "Délai d'attente Caisse212 dépassé", {
          correlationId,
          retryable: true,
        });
      }
      throw new Caisse212Error("unavailable", "Erreur réseau vers Caisse212", {
        correlationId,
        retryable: true,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  fetchCatalog(): Promise<CatalogSnapshot> {
    return this.request("/v1/catalog", {}, catalogSnapshotSchema);
  }

  fetchChanges(cursor?: string): Promise<CatalogChanges> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return this.request(`/v1/catalog/changes${query}`, {}, catalogChangesSchema);
  }

  getAvailability(): Promise<AvailabilitySnapshot> {
    return this.request("/v1/catalog/availability", {}, availabilitySnapshotSchema);
  }

  submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    return this.request(
      "/v1/orders",
      {
        method: "POST",
        body: input,
        timeoutMs: 20_000,
        correlationId: input.externalOrderId,
      },
      submitOrderResultSchema,
    );
  }

  async getOrderByExternalId(
    externalOrderId: string,
  ): Promise<ExternalOrderStatus | null> {
    try {
      return await this.request(
        `/v1/orders/by-external-id/${encodeURIComponent(externalOrderId)}`,
        { correlationId: externalOrderId },
        externalOrderStatusSchema,
      );
    } catch (error) {
      if (error instanceof Caisse212Error && error.code === "unexpected") return null;
      throw error;
    }
  }

  async getOrderStatus(posOrderId: string): Promise<ExternalOrderStatus | null> {
    try {
      return await this.request(
        `/v1/orders/${encodeURIComponent(posOrderId)}`,
        { correlationId: posOrderId },
        externalOrderStatusSchema,
      );
    } catch (error) {
      if (error instanceof Caisse212Error && error.code === "unexpected") return null;
      throw error;
    }
  }
}
