import { NextResponse } from "next/server";
import { StorefrontError, storefrontErrorMessage } from "./errors";

export function storefrontErrorResponse(error: unknown): NextResponse {
  if (error instanceof StorefrontError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { ok: false, error: storefrontErrorMessage(error) },
    { status: 500 },
  );
}

export function parseNumericId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
