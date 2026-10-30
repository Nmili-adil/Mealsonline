# Testing Guide

## Test stack

- **Vitest** for unit and integration tests.
- Tests run against a dedicated SQLite database (`prisma/test.db`) migrated
  automatically by the `pretest` script.
- The mock Caisse212 provider is reset between tests; integration tests share
  one file-backed mock state.

## Run

```bash
npm test           # migrate test.db + run all tests once
npm run test:watch # watch mode
npm run typecheck  # strict TypeScript
npm run build      # production build (also catches route/type issues)
```

## What is covered

### Unit tests

| File | Covers |
| ---- | ------ |
| `tests/unit/money.test.ts` | minor-unit conversions, sums, MAD formatting |
| `tests/unit/validation.test.ts` | phone normalization, checkout schemas |
| `tests/unit/transitions.test.ts` | allowed/invalid/idempotent status transitions |
| `tests/unit/webhook-signature.test.ts` | HMAC verification, timestamp freshness |

### Integration tests

| File | Covers |
| ---- | ------ |
| `tests/integration/catalog-sync.test.ts` | idempotent import, POS price change, availability |
| `tests/integration/checkout-outbox.test.ts` | stale-price rejection, unavailable product, accepted flow, POS idempotency, offline never confirms |
| `tests/integration/timeout-recovery.test.ts` | ambiguous timeout reconciled via external-ID lookup |
| `tests/integration/webhook-dedupe.test.ts` | duplicate webhook applied once, invalid transition rejected |

### Explicit acceptance checks

1. Two retries of the same external order produce one logical POS order — covered in `checkout-outbox.test.ts`.
2. A duplicate webhook does not duplicate order events — `webhook-dedupe.test.ts`.
3. A price change prevents confirmation at the stale price — `checkout-outbox.test.ts`.
4. An unavailable product cannot be checked out — `checkout-outbox.test.ts`.
5. POS unavailability never produces a false customer confirmation — `checkout-outbox.test.ts`.
6. Missing POS credentials prevent live order submission — enforced by `getCaisse212Provider()` (fail closed); add a dedicated test when the live adapter has a test double.

### Manual E2E smoke (verified during development)

- `GET /` 200, `GET /api/menu` returns brands/categories/products.
- `POST /api/checkout/validate` returns authoritative totals.
- `POST /api/checkout/submit` creates a pending order.
- `npm run worker` processes the outbox; `GET /api/orders/[reference]` with
  the tracking token returns the accepted status.
- `npm run build` passes for all routes.

### Playwright

Playwright (`@playwright/test` + Chromium) is installed for browser E2E:

```bash
npm run e2e:install   # one-time browser download
npm run e2e           # runs the e2e/ specs against a local server on :3200
```

Specs (`e2e/`):

| File | Covers |
| ---- | ------ |
| `menu-cart.spec.ts` | browse menu, brand filter, product customization, cart edit |
| `checkout-tracking.spec.ts` | add to cart, checkout, tracking until POS acceptance (spawns the outbox worker) |
| `admin.spec.ts` | admin login, manual catalog import |

The E2E server runs `next start` with `CAISSE212_ALLOW_MOCK_IN_PROD=true`
(explicit test-only opt-in; normal production still refuses mock mode).
