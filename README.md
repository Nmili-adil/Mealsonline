# MealsOnline — Restaurant Online Ordering + Caisse212 Integration

Premium dark restaurant website for a multi-brand restaurant (PizzaHub,
CIAO PASTA, Smash It Burgers) with online ordering, a synchronized catalog,
customer order tracking and a protected admin dashboard — integrated with the
Caisse212 POS/KDS through a typed, mock-first adapter.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Prisma (SQLite dev / MySQL prod) · Zustand · React Hook Form + Zod ·
Framer Motion · Phosphor icons · Vitest.

## Quick start (development)

```bash
npm install
cp .env.example .env        # CAISSE212_MODE=mock + Storefront fixtures by default
npm run db:migrate          # create SQLite dev.db + migration
npm run db:seed             # default restaurant + admin + mock catalog import
npm run dev                 # http://localhost:3000
```

In separate terminals:

```bash
npm run worker              # outbox worker: submits orders to Caisse212
npm run sync-worker         # scheduled catalog synchronization (every 5 min)
```

Initial admin (from seed): `admin@mealsonline.ma` / `ChangeMe123!`
(override with `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars — change it).

## Main routes

| Public | Admin |
| ------ | ----- |
| `/` landing · `/menu` · `/menu/[slug]` · `/cart` · `/checkout` · `/orders/[reference]` · `/about` · `/contact` · `/privacy` · `/terms` | `/admin` · `/admin/products` · `/admin/categories` · `/admin/orders` · `/admin/websites` · `/admin/websites/new` · `/admin/websites/[id]/edit` · `/admin/sync` · `/admin/pages` · `/admin/media` · `/admin/settings` · `/admin/integrations` · `/admin/audit-logs` |

## Scripts

```bash
npm run dev            # Next dev server
npm run build          # production build
npm run start          # production server
npm run typecheck      # strict TypeScript
npm run db:migrate     # Prisma migrate dev
npm run db:deploy      # Prisma migrate deploy (production)
npm run db:seed        # seed dev fixtures + initial admin
npm run worker         # outbox worker (order submission + reconciliation)
npm run sync-worker    # scheduled catalog sync
npm test               # unit + integration tests (SQLite test.db)
npm run e2e            # Playwright browser flows (run `npm run build` first)
```

## Storefront V206 (public website content)

The public website consumes the Caisse212 **Storefront V206** contract:

- `CAISSE212_STOREFRONT_MODE=off` keeps the legacy DB-driven menu.
- `fixtures` (default in development) renders local fixtures with a visible
  demo banner; admin changes are reflected immediately.
- `live` calls the real public endpoints and the authenticated storefront
  admin endpoints. Live admin calls require server-only
  `CAISSE212_ADMIN_TOKEN`, `CAISSE212_TENANT_ID`, `CAISSE212_BUSINESS_ID`;
  without them the admin reports the blocker instead of faking a session.

Dynamic theming, collections (absent vs empty), hidden products, display
overrides, ordering-enabled enforcement, saved/draft preview and unknown-key
preservation are implemented. The V206 ordering/tracking payload schemas are
not published, so checkout and tracking keep the website's documented order
integration; see `docs/STOREFRONT_V206.md` for confirmed vs assumed vs blocked
behaviour and the live id-mapping assumption.

## Caisse212 integration

- `CAISSE212_MODE=mock` uses a file-backed mock provider with fixtures and
  fault scenarios (price change, unavailable product, rejected order, POS
  offline, duplicate order, ambiguous timeout, missed webhooks).
- `CAISSE212_MODE=live` fails closed until `CAISSE212_BASE_URL`,
  `CAISSE212_CLIENT_ID`, `CAISSE212_CLIENT_SECRET` are configured. Mock mode
  is refused in production builds.
- The browser never talks to Caisse212; orders go through a transactional
  outbox with idempotency keys, bounded retries and ambiguous-timeout
  reconciliation.

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/CAISSE212_API_CONTRACT.md` (proposed endpoints — pending partner confirmation)
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/TESTING.md`
- `docs/INTEGRATION_HANDOFF.md`
- `docs/STOREFRONT_V206.md` (public storefront config/menu/admin integration)

## Production

See `docs/DEPLOYMENT.md`. Summary: MySQL + `db:deploy` + `next build` +
`next start` + `worker` + `sync-worker` under a process supervisor, HTTPS via
reverse proxy, `CAISSE212_MODE=live`.
# Mealsonline
