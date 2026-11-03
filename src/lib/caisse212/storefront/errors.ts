export type StorefrontErrorCode =
  | "not_found"
  | "not_configured"
  | "fixtures_forbidden"
  | "invalid_response"
  | "timeout"
  | "upstream_error"
  | "contract_unverified";

export class StorefrontError extends Error {
  readonly code: StorefrontErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: StorefrontErrorCode, message: string, status = 502, details?: unknown) {
    super(message);
    this.name = "StorefrontError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function storefrontErrorMessage(error: unknown): string {
  if (error instanceof StorefrontError) return error.message;
  if (error instanceof Error) return error.message;
  return "Erreur inattendue lors de l'appel à Caisse212";
}
