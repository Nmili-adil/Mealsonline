# MealsOnline — Architecture

## Overview

MealsOnline is a Next.js 16 (App Router, React 19) restaurant website that:

1. Mirrors the Caisse212 product catalog into its own database.
2. Lets customers browse brands/categories, customize products, and place orders.
3. Persists orders durably and submits them to Caisse212 through a transactional outbox.
4. Receives order-status webhooks from Caisse212 and tracks orders for customers.
5. Provides a protected administration dashboard.

Caisse212 remains authoritative for product identity, pricing, availability,
POS acceptance, kitchen dispatch and operational status. The website never
calls Caisse212 from the browser and never creates KDS tickets directly.

## Component map

```
┌───────────────────────────────┐        ┌──────────────────────────────┐
│  Browser (customer)           │        │  Browser (admin)             │
│  /, /menu, /menu/[slug],      │        │  /admin/*                    │
│  /cart, /checkout,            │        │  HttpOnly session cookie     │
│  /orders/[reference]          │        │  + CSRF header               │
└──────────────┬────────────────┘        └──────────────┬───────────────┘
               │ HTTP                                    │ HTTP
┌──────────────▼────────────────┐        ┌──────────────▼───────────────┐
│  Next.js 16 (App Router)      │        │  API routes (route handlers) │
│  Server Components by default │        │  /api/checkout/*             │
│  Route Handlers for APIs      │        │  /api/admin/*                │
│  Server-side auth (scrypt,    │        │  /api/webhooks/caisse212     │
│  DB sessions, CSRF)           │        │  /api/menu, /api/orders      │
└──────────────┬────────────────┘        └──────────────┬───────────────┘
               │ Prisma                                  │ Prisma
┌──────────────▼─────────────────────────────────────────▼──────────────┐
│  SQLite (dev/tests) / MySQL (production)                               │
│  Catalog mirror · OnlineOrder · OrderStatusEvent · IntegrationOutbox  │
│  IntegrationInbox · MenuSyncRun · AdminUser/Session · AuditLog        │
└──────────────┬─────────────────────────────────────────┬──────────────┘
               │                                         │
┌──────────────▼──────────────┐            ┌─────────────▼───────────────┐
│  Worker: outbox-worker      │            │  Worker: sync-worker        │
│  - submits orders (outbox)  │            │  - scheduled catalog sync   │
│  - ambiguous-timeout lookup │            │  - availability updates     │
│  - status reconciliation    │            │                             │
└──────────────┬──────────────┘            └─────────────┬───────────────┘
               │ server-to-server only                  │
┌──────────────▼─────────────────────────────────────────▼──────────────┐
│  Caisse212 provider (typed adapter)                                    │
│  ├─ mock.ts     file-backed development provider (fixtures/scenarios)  │
│  └─ client.ts   live HTTP provider, fails closed when not configured   │
└─────────────────────────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────┐
│  Caisse212 POS/KDS (external)│
└──────────────────────────────┘
```

## Key design decisions

- **Portable Prisma schema.** No native enums, no native JSON, no `@db.*`
  annotations — the same migrations run on SQLite (dev/test) and MySQL
  (production). Money is stored as integer minor units (centimes MAD).
- **Server components by default.** Client components are used only for
  interactive pieces (cart, menu filters, checkout form, tracking, admin
  tables).
- **Cache Components disabled.** Public pages read live catalog/order data
  and admin pages read the session cookie per request, so the project opts
  out of Next 16 Cache Components (see `next.config.ts`).
- **Durable order submission.** Checkout writes the order + outbox event in a
  single Prisma transaction. A separate worker delivers with idempotency
  keys, bounded retries and ambiguous-timeout reconciliation.
- **Four status dimensions.** Acceptance, preparation, payment and
  fulfillment are stored separately; a derived display status is computed.
- **Soft deletion for catalog.** POS removals archive records (`archived`
  flag) so order history is preserved.
- **Mock provider is file-backed** (`.data/mock-caisse212.json`) so the Next
  server, workers and tests share one simulated POS state. Mock mode is
  refused in production builds.

## Directory layout

```
src/app/                 App Router pages and API routes
src/components/          Storefront + admin UI components
src/lib/caisse212/       Typed Caisse212 adapter (types, schemas, client, mock, catalog, orders, webhooks)
src/lib/sync/            Catalog synchronization engine
src/lib/orders/          Checkout validation, order creation, outbox, transitions, tracking
src/lib/auth/            Admin sessions, guards, rate limiting
src/lib/                 prisma, money, crypto, site settings, constants, utils
src/store/               Zustand persisted cart
prisma/                  schema.prisma, migrations, seed
worker/                  outbox-worker.ts, sync-worker.ts
tests/                   unit + integration tests (vitest)
docs/                    this documentation set
```
