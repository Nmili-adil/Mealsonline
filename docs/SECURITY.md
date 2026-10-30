# Security Guide

## Browser ↔ website

- **No Caisse212 credentials in the browser.** All POS communication happens
  server-to-server from `src/lib/caisse212/`.
- **No trusted client prices.** Checkout always revalidates every line,
  variant, modifier, availability and total against the database mirror.
  `POST /api/checkout/validate` and `POST /api/checkout/submit` never read
  prices from the request body.
- **Order tracking protection.** `GET /api/orders/[reference]` requires the
  high-entropy tracking token (`x-tracking-token`). The reference alone
  returns nothing. Responses contain no phone, address or internal IDs.
- **Admin API.** Every `/api/admin/*` route checks the session. Mutations
  additionally require the `x-csrf-token` header (double-submit token stored
  in the server session) and an Origin/Referer same-origin check.
- **Input validation.** All request bodies are parsed with Zod
  (`src/lib/validation/`, `src/lib/caisse212/schemas.ts`).
- **Output encoding.** React escapes rendered content by default; no
  `dangerouslySetInnerHTML` is used.
- **Rate limiting.** Login is rate-limited per IP hash (in-memory for a single
  instance). For multi-instance deployments, replace
  `src/lib/auth/rate-limit.ts` with a durable store (Redis/DB).

## Admin authentication

- Server-side sessions with **HttpOnly**, **SameSite=Lax**, **Secure in
  production** cookies. The raw token is never stored; only its SHA-256 hash
  lives in `AdminSession`.
- Passwords are hashed with **scrypt** + salt + pepper (`AUTH_SECRET`).
- No public registration. The initial admin is provisioned by the seed script
  from `ADMIN_EMAIL` / `ADMIN_PASSWORD` environment variables — never by a
  public endpoint with a default password.
- Audit logs record admin actions (with IP hash, not raw IP).

## Caisse212 integration

- **Fail closed in live mode.** If `CAISSE212_MODE=live` and any of
  `CAISSE212_BASE_URL`, `CAISSE212_CLIENT_ID`, `CAISSE212_CLIENT_SECRET` are
  missing, the provider refuses to operate and reports unavailable.
- **Mock mode is refused in production builds** (`NODE_ENV=production`).
  The only exception is the explicit, non-silent test opt-in
  `CAISSE212_ALLOW_MOCK_IN_PROD=true` used by the E2E suite.
- **Webhooks** verify HMAC-SHA256 over the raw body, check timestamp
  freshness (±5 min), deduplicate event IDs, and enforce allowed status
  transitions.
- **At-least-once order submission** with stable idempotency keys. Caisse212
  must implement matching idempotent acceptance (see API contract).
- **Correlation IDs** on every external request; structured errors in
  `IntegrationError`.

## Secrets

- Secrets live in environment variables only (`.env` is git-ignored; see
  `.env.example`). Never commit real credentials.
- Admin dashboard never displays raw API secrets.

## Data minimization

- Customer data collected: name, phone, optional delivery address/notes.
- Audit logs store IP hashes, not raw IPs. Webhook payloads are stored
  redacted where personal data is unnecessary.
