# Integration Handoff — Caisse212 Partner

This document lists exactly what the Caisse212 partner must implement, and
what the website operator must configure when the real API becomes available.

## What the Caisse212 partner must implement

### 1. Server-to-server API (see `docs/CAISSE212_API_CONTRACT.md` for shapes)

| # | Requirement | Proposed path |
| - | ----------- | ------------- |
| 1 | Full catalog snapshot: brands, categories, products, variants, modifier groups, prices (integer centimes MAD) | `GET /v1/catalog` |
| 2 | Incremental catalog changes with an opaque cursor **or** accept that the website falls back to full snapshot reconciliation | `GET /v1/catalog/changes?cursor=` |
| 3 | Availability feed per product | `GET /v1/catalog/availability` |
| 4 | Order submission with idempotency on `externalOrderId` | `POST /v1/orders` |
| 5 | Order lookup by external order ID (critical for timeout recovery) | `GET /v1/orders/by-external-id/{id}` |
| 6 | Order status by POS order ID | `GET /v1/orders/{posOrderId}` |
| 7 | Webhooks for order events, HMAC-SHA256 signed, with unique event IDs | `POST <website>/api/webhooks/caisse212` |

### 2. Mandatory semantics

- **Idempotent acceptance.** Same `externalOrderId` → same logical POS order,
  no duplicate POS orders, no duplicate KDS dispatch.
- **Persist before respond.** On timeout, the website will look the order up
  by `externalOrderId`; the POS must already have it.
- **Stale price rejection.** When `expectedTotal` differs from the POS total
  and `acceptRepricing=false`, reject with `stale_price` and the authoritative
  total.
- **Webhook at-least-once** delivery with a forever-unique event ID.
- **KDS routing** is entirely Caisse212's responsibility — the website never
  creates KDS tickets.
- **Webhook signature** `HMAC-SHA256(CAISSE212_WEBHOOK_SECRET, rawBody)` hex,
  plus `x-caisse212-timestamp` unix seconds.

### 3. Confirm or correct these assumptions

- Authentication scheme (currently `Authorization: Bearer clientId:clientSecret`).
- Exact endpoint paths and verbs.
- Real webhook event names (currently `order.accepted`, `order.rejected`,
  `order.preparing`, `order.ready`, `order.dispatched`, `order.delivered`,
  `order.cancelled`).
- Whether a quote/pre-validation endpoint exists.
- How payment state (cash on delivery / pay at pickup) is reported back.

## What the website operator must configure when the real API is ready

1. Set in `.env`:
   - `CAISSE212_MODE=live`
   - `CAISSE212_BASE_URL`, `CAISSE212_CLIENT_ID`, `CAISSE212_CLIENT_SECRET`
   - `CAISSE212_WEBHOOK_SECRET` (same value shared with the partner)
2. Give the partner the public webhook URL:
   `https://<domain>/api/webhooks/caisse212`.
3. Adjust `src/lib/caisse212/client.ts` if the real authentication or endpoint
   paths differ from the proposal.
4. Adjust `src/lib/orders/transitions.ts` if the real webhook event names
   differ.
5. Allow-list the POS image host in `next.config.ts` (`images.remotePatterns`)
   if product images are served from the POS CDN.
6. Deploy, then run a manual sync from `/admin/sync` and verify product counts.
7. Run the acceptance checks in `docs/TESTING.md` against the live provider
   with a test order.

## Website-side responsibilities (already implemented)

- Catalog mirror with idempotent upserts and soft deletion.
- Transactional outbox with stable idempotency keys, bounded retries,
  ambiguous-timeout reconciliation, acceptance deadlines.
- Webhook verification, deduplication and allowed transitions.
- Background reconciliation for missed webhooks.
- Mock provider for development (`CAISSE212_MODE=mock`), refused in production.
