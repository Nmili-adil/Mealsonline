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

Latest verified run: **64 Vitest tests across 12 files**, **4/4 Playwright
E2E tests**, `tsc --noEmit` clean, production build green.

## What is covered

### Unit tests

| File | Covers |
| ---- | ------ |
| `tests/unit/money.test.ts` | minor-unit conversions, sums, MAD formatting |
| `tests/unit/validation.test.ts` | phone normalization, checkout schemas |
| `tests/unit/transitions.test.ts` | allowed/invalid/idempotent status transitions |
| `tests/unit/webhook-signature.test.ts` | HMAC verification, timestamp freshness |
| `tests/unit/storefront-validation.test.ts` | storefront slug/origin/256 KB/section/override rules, unknown-key preservation |
| `tests/unit/storefront-menu.test.ts` | collections absent/empty/custom, ordering, dedupe, hidden products, overrides, product detail |
| `tests/unit/storefront-roles.test.ts` | ADMIN/SUPER_ADMIN storefront permission rule |

### Integration tests

| File | Covers |
| ---- | ------ |
| `tests/integration/catalog-sync.test.ts` | idempotent import, POS price change, availability |
| `tests/integration/checkout-outbox.test.ts` | stale-price rejection, unavailable product, accepted flow, POS idempotency, offline never confirms |
| `tests/integration/timeout-recovery.test.ts` | ambiguous timeout reconciled via external-ID lookup |
| `tests/integration/webhook-dedupe.test.ts` | duplicate webhook applied once, invalid transition rejected |
| `tests/integration/storefront-fixtures.test.ts` | public config/menu, inactive 404, admin CRUD/version/soft delete/slug reuse, invalid ids, price override rejection, per-site isolation, checkout id bridge |

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
| `menu-cart.spec.ts` | homepage + storefront banner, collection filter, product customization, cart edit |
| `checkout-tracking.spec.ts` | add to cart, checkout, tracking until POS acceptance (spawns the outbox worker) |
| `admin.spec.ts` | admin login, manual catalog import |
| `admin-websites.spec.ts` | create a website, custom-section toggle, full PUT version bump, list refresh |

The E2E server runs `next start` with `CAISSE212_ALLOW_MOCK_IN_PROD=true` and
`CAISSE212_ALLOW_STOREFRONT_FIXTURES_IN_PROD=true` (explicit test-only opt-ins;
normal production still refuses mock and fixtures modes).
