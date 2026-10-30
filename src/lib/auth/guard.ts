import "server-only";
import { NextResponse } from "next/server";
import { getAdminSession } from "./session";
import { CSRF_HEADER_NAME } from "@/lib/constants";

/**
 * Require an authenticated admin session for an API route.
 * Returns either a NextResponse error or the session context.
 */
export async function requireAdminApi(): Promise<
  | { ok: true; session: Awaited<ReturnType<typeof getAdminSession>> }
  | { ok: false; response: NextResponse }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non autorisé" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

/**
 * Verify the CSRF header for cookie-authenticated mutations.
 */
export function verifyCsrf(
  session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>,
  request: Request,
): boolean {
  const header = request.headers.get(CSRF_HEADER_NAME);
  if (!header) return false;
  return header === session.session.csrfToken;
}

/** SameSite=lax + Origin/Referer check for cookie-authenticated mutations. */
export function verifySameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!origin && !referer) return false;
  const source = origin ?? referer;
  if (!source) return false;

  try {
    const sourceUrl = new URL(source);
    // Accept either the canonical app URL or the request's own host
    // (covers localhost vs 127.0.0.1 and proxies that rewrite Host).
    if (baseUrl) {
      if (sourceUrl.origin === new URL(baseUrl).origin) return true;
    }
    const host = request.headers.get("host");
    return host ? sourceUrl.host === host : false;
  } catch {
    return false;
  }
}

/** Full guard for cookie-authenticated admin mutations (auth + CSRF + origin). */
export async function requireAdminMutation(request: Request): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>> }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth;
  const session = auth.session!;
  if (!verifyCsrf(session, request) || !verifySameOrigin(request)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "CSRF invalide" }, { status: 403 }),
    };
  }
  return { ok: true, session };
}
