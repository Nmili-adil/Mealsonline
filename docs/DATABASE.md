# Database Guide

## Engines

- **Development/tests:** SQLite (`file:./dev.db` / `file:./test.db`).
- **Production:** MySQL. Switch `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

then run `npm run db:deploy` against the production database. The schema is
intentionally portable (no native enums, no native JSON, no `@db.*`
annotations) so the same migration history applies cleanly.

## Money

All monetary values are **integer minor units** (centimes of MAD):
`49 MAD = 4900`. Never use floats. Helpers live in `src/lib/money.ts`.

## Main tables

### Catalog mirror

| Table                  | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `Restaurant`           | Single restaurant record (slug `mealsonline`)         |
| `Brand`                | PizzaHub / CIAO PASTA / Smash It Burgers             |
| `Category`             | Menu categories                                      |
| `Product`              | Product mirror; `externalId` = Caisse212 product ID  |
| `ProductVariant`       | Sizes/prices (POS-authoritative)                     |
| `ModifierGroup`        | Optional/required option groups                      |
| `Modifier`             | Options with prices                                  |
| `ProductModifierGroup` | Which groups apply to which product                  |
| `ProductImage`         | Extra product images                                 |

Constraints:
- `@@unique([restaurantId, externalId])` for stable mappings.
- Soft deletion via `archived` flag — never hard-delete catalog rows that
  could be referenced by order history.

### Orders

| Table                      | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `OnlineOrder`              | Durable order with reference + tracking token      |
| `OnlineOrderItem`          | Item snapshot (name, variant, price, quantity)     |
| `OnlineOrderItemModifier`  | Modifier snapshot per item                         |
| `OrderPayment`             | Payment method + state                             |
| `OrderStatusEvent`         | Full status history (idempotency-keyed)            |

Order snapshots: item names, variant names, modifier names and prices are
copied at checkout time so later catalog changes never rewrite history.
Uniqueness: `(restaurantId, externalOrderId)` and `(restaurantId, posOrderId)`.

Four independent dimensions: `acceptanceState`, `preparationState`,
`paymentState`, `fulfillmentState`. The display `status` is derived.

### Integration reliability

| Table               | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `IntegrationOutbox` | Durable submission queue (idempotency key = external order ID) |
| `IntegrationInbox`  | Webhook deduplication store (unique external event ID) |
| `IntegrationError`  | Structured integration errors for the dashboard      |
| `MenuSyncRun`       | Sync history (counts, status, errors)                |
| `MenuSyncCursor`    | Incremental sync cursor                              |

### Admin

| Table          | Purpose                                        |
| -------------- | ---------------------------------------------- |
| `AdminUser`    | scrypt-hashed credentials, role                |
| `AdminSession` | HttpOnly cookie sessions (token hash), CSRF    |
| `AuditLog`     | Redacted admin actions                         |

### CMS

| Table        | Purpose                                    |
| ------------ | ------------------------------------------ |
| `Setting`    | Key/value CMS settings (JSON text)         |
| `MediaAsset` | Optional managed media registry            |

## Migrations

```bash
npm run db:migrate   # dev: create/apply migrations
npm run db:deploy    # production: apply pending migrations
npm run db:generate  # regenerate Prisma Client
```

## Seed

```bash
npm run db:seed
```

Creates the default restaurant, an admin
(`ADMIN_EMAIL`/`ADMIN_PASSWORD`, defaults `admin@mealsonline.ma` /
`ChangeMe123!`) and imports the mock Caisse212 catalog.
