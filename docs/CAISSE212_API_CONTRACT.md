# Caisse212 API Contract (PROPOSED — pending partner confirmation)

> **Status: UNCONFIRMED.** Every endpoint path, header name, payload shape and
> webhook event name in this document is a PROPOSAL for the Caisse212 partner
> to implement or correct. The website code is already typed and validated
> against these shapes (`src/lib/caisse212/`), so when the real contract is
> confirmed we only adjust the adapter — not the rest of the application.

## 1. Transport and authentication

- HTTPS only.
- Base URL configured in `CAISSE212_BASE_URL` (server-side only).
- Authentication: `Authorization: Bearer <clientId>:<clientSecret>`.
  (Replace with the real scheme — OAuth2 client credentials, API key, etc. —
  when confirmed.)
- Every request may carry `x-correlation-id` (UUID) for tracing.
- All monetary values are **integer minor units** (centimes of MAD).
  `49 MAD = 4900`. Floats are invalid.

## 2. Product/variant/modifier identifiers

- Caisse212 external IDs are strings, unique per restaurant scope.
- The website stores `restaurantId + externalId` with a unique constraint and
  never generates its own external IDs.
- Variant IDs are unique per product. Modifier IDs are unique per modifier
  group. Modifier groups are top-level objects referenced by products.

## 3. Proposed endpoints

### 3.1 `GET /v1/catalog` — full snapshot

Response (validated by `catalogSnapshotSchema`):

```json
{
  "generatedAt": "2026-10-27T10:00:00.000Z",
  "brands": [
    {
      "externalId": "brand-pizzahub",
      "name": "PizzaHub",
      "tagline": "Pizzas artisanales",
      "logoUrl": "https://cdn.example.com/pizzahub.png",
      "imageUrl": "https://cdn.example.com/pizzahub-hero.png",
      "accentColor": "#ef2638",
      "sortOrder": 1,
      "active": true
    }
  ],
  "categories": [
    {
      "externalId": "cat-pizzas",
      "brandExternalId": "brand-pizzahub",
      "name": "Pizzas",
      "description": "Pizzas au feu de bois",
      "imageUrl": "https://cdn.example.com/pizzas.png",
      "sortOrder": 1,
      "active": true
    }
  ],
  "products": [
    {
      "externalId": "prod-margherita",
      "brandExternalId": "brand-pizzahub",
      "categoryExternalId": "cat-pizzas",
      "name": "Margherita",
      "description": "Sauce tomate, mozzarella, basilic.",
      "ingredients": ["Sauce tomate", "Mozzarella", "Basilic"],
      "imageUrl": "https://cdn.example.com/margherita.png",
      "available": true,
      "sortOrder": 1,
      "variants": [
        {
          "externalId": "var-margherita-med",
          "name": "Medium",
          "price": 2900,
          "isDefault": true,
          "sortOrder": 1
        }
      ],
      "modifierGroupExternalIds": ["grp-pizza-extras"]
    }
  ],
  "modifierGroups": [
    {
      "externalId": "grp-pizza-extras",
      "name": "Suppléments pizza",
      "minSelection": 0,
      "maxSelection": 3,
      "required": false,
      "modifiers": [
        { "externalId": "mod-extra-cheese", "name": "Extra fromage", "price": 800 }
      ]
    }
  ]
}
```

### 3.2 `GET /v1/catalog/changes?cursor=<cursor>` — incremental changes

Response (validated by `catalogChangesSchema`):

```json
{
  "cursor": "42",
  "generatedAt": "2026-10-27T10:05:00.000Z",
  "upserts": { "...same shape as the snapshot, containing only changed entities..." },
  "removed": { "brands": [], "categories": [], "products": ["prod-deleted"] }
}
```

- If incremental changes are not supported, the website falls back to the
  full snapshot reconciliation.
- Cursor semantics: opaque string; pass back exactly.

### 3.3 `GET /v1/catalog/availability` — availability

```json
{
  "generatedAt": "2026-10-27T10:05:00.000Z",
  "items": [{ "externalProductId": "prod-margherita", "available": true }]
}
```

### 3.4 `POST /v1/orders` — order submission

Request:

```json
{
  "externalOrderId": "EXT-<random>",
  "brandExternalId": "brand-pizzahub",
  "fulfillmentType": "delivery",
  "customer": { "name": "Jean Dupont", "phone": "+212612345678" },
  "delivery": { "address": "Hay Izdihar, Marrakech", "instructions": "Digicode 1234" },
  "orderNote": "Sans oignons",
  "paymentMethod": "cash_on_delivery",
  "currency": "MAD",
  "expectedTotal": 7400,
  "acceptRepricing": false,
  "lines": [
    {
      "externalProductId": "prod-margherita",
      "externalVariantId": "var-margherita-med",
      "quantity": 2,
      "externalModifierIds": ["mod-extra-cheese"],
      "notes": "Bien cuite",
      "unitPrice": 2900
    }
  ]
}
```

Response — accepted:

```json
{
  "accepted": true,
  "externalOrderId": "EXT-<random>",
  "posOrderId": "POS-123456",
  "authoritativeTotal": 7400,
  "repriced": false,
  "acceptedAt": "2026-10-27T10:10:00.000Z"
}
```

Response — rejected:

```json
{
  "accepted": false,
  "externalOrderId": "EXT-<random>",
  "rejectionReason": "product_unavailable"
}
```

Response — stale price (POS must reject when `expectedTotal` differs and
`acceptRepricing` is false):

```json
{
  "accepted": false,
  "externalOrderId": "EXT-<random>",
  "authoritativeTotal": 7800,
  "repriced": true,
  "rejectionReason": "stale_price"
}
```

### 3.5 `GET /v1/orders/by-external-id/{externalOrderId}` — lookup

Response (validated by `externalOrderStatusSchema`):

```json
{
  "externalOrderId": "EXT-<random>",
  "posOrderId": "POS-123456",
  "acceptance": "accepted",
  "preparation": "preparing",
  "fulfillment": "pending",
  "payment": "pending",
  "updatedAt": "2026-10-27T10:11:00.000Z"
}
```

Returns `404` when unknown (the website treats it as `null`).

### 3.6 `GET /v1/orders/{posOrderId}` — status by POS order ID

Same response shape as 3.5.

## 4. Order acceptance contract

- Caisse212 must accept the order idempotently: submitting the **same
  `externalOrderId`** twice must return the same logical POS order
  (`posOrderId`) and must not create duplicates or duplicate KDS tickets.
- On ambiguous network timeout, the website will call 3.5 **before** retrying,
  and reuse the same `externalOrderId`. Caisse212 must persist the order
  before responding, so the lookup can find it.
- Repricing: if the POS total differs from `expectedTotal` and
  `acceptRepricing` is false, reject with `stale_price` + the authoritative
  total. The website will present the new total to the customer.
- Acceptance deadline: the website uses `ORDER_ACCEPTANCE_TIMEOUT_SECONDS`
  (default 180). After that the outbox worker does a final lookup before
  expiring the order.

## 5. Webhooks

### 5.1 Delivery

`POST https://<website>/api/webhooks/caisse212`

Headers:

```
x-caisse212-signature: <hex HMAC-SHA256 of the raw body>
x-caisse212-timestamp: <unix seconds>
```

The signature is `HMAC-SHA256(secret, rawBody)`, hex-encoded, using
`CAISSE212_WEBHOOK_SECRET`. Timestamps older than 5 minutes are rejected.

Payload (validated by `webhookEventSchema`):

```json
{
  "id": "evt-<unique-pos-event-id>",
  "type": "order.accepted",
  "timestamp": "2026-10-27T10:10:00.000Z",
  "data": {
    "externalOrderId": "EXT-<random>",
    "posOrderId": "POS-123456",
    "reason": null
  }
}
```

### 5.2 Proposed event types

| Event              | Effect on website                                             |
| ------------------ | ------------------------------------------------------------- |
| `order.accepted`   | acceptance=accepted, record `posOrderId`                      |
| `order.rejected`   | acceptance=rejected, fulfillment=cancelled                    |
| `order.preparing`  | preparation=preparing                                         |
| `order.ready`      | preparation=ready                                             |
| `order.dispatched` | preparation=dispatched                                        |
| `order.delivered`  | preparation=delivered, fulfillment=completed                  |
| `order.cancelled`  | fulfillment=cancelled                                         |

These names are logical. When the real POS event names are confirmed, map
them in `src/lib/orders/transitions.ts`.

### 5.3 POS/KDS responsibilities

- Caisse212 creates the POS order and routes accepted items to the KDS.
  The website never creates KDS tickets.
- Event IDs must be unique forever; the website deduplicates on them.
- Events must be delivered at-least-once; the website tolerates duplicates
  and out-of-order events (with a reconciliation worker as fallback).

## 6. Error codes

| Code                 | Meaning                                  | Website behaviour              |
| -------------------- | ---------------------------------------- | ------------------------------ |
| `not_configured`     | live mode missing credentials            | integration unavailable        |
| `timeout`            | no response within deadline              | retry + lookup before retry    |
| `unavailable`        | POS/network unavailable                  | bounded retry                  |
| `rejected`           | POS rejected the order                   | terminal, user-facing reason   |
| `validation`         | malformed request                        | fail closed                    |
| `stale_price`        | POS total differs from expected          | ask customer to approve        |
| `product_unavailable`| a line item is unavailable               | terminal, user-facing reason   |
| `duplicate`          | same external order ID                   | return existing result         |
| `auth_failed`        | bad credentials                          | fail closed                    |
| `unexpected`         | anything else                            | logged, bounded retry          |

## 7. Open questions for the Caisse212 partner

1. Exact endpoint paths and HTTP verbs.
2. Real authentication mechanism (Bearer? OAuth2? signed requests?).
3. Whether `catalog/changes` incremental updates are available.
4. Real webhook event names and payload fields.
5. Whether the POS returns a quote endpoint for pre-validation.
6. How refunds/payment state are reported back.
