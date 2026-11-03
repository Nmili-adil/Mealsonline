# Caisse212 Storefront V206 — website integration

Status: implemented against the **Storefronts — Client Website Config, Backend V206
(2026-10-29)** contract. The V206 backend changes were uncommitted when the
specification was written, so this document separates **confirmed**, **assumed**
and **blocked** behaviour.

## 1. Modes

| `CAISSE212_STOREFRONT_MODE` | Public site | Admin `/admin/websites` |
| --- | --- | --- |
| `off` | Legacy DB-driven menu (no storefront calls) | Disabled |
| `fixtures` | Local fixtures (`.data/storefront-fixtures.json`), clearly labelled | Full CRUD against fixtures |
| `live` | Real public V206 endpoints | Real authenticated V206 endpoints (requires credentials) |

Fixtures are refused when `NODE_ENV=production` unless
`CAISSE212_ALLOW_STOREFRONT_FIXTURES_IN_PROD=true` (test-only escape hatch used
by Playwright). Live admin calls require **server-only** variables:

```env
CAISSE212_BASE_URL=https://app.caisse212.com
CAISSE212_ADMIN_TOKEN=…        # bearer token, ADMIN/SUPER_ADMIN role
CAISSE212_TENANT_ID=…
CAISSE212_BUSINESS_ID=…
```

These variables are never exposed to the browser. If they are missing in live
mode the admin shows the list of missing variables instead of faking a session.

## 2. Public integration

Server-side client: `src/lib/caisse212/storefront/public.ts`.

| Endpoint | Usage | Cache |
| --- | --- | --- |
| `GET /api/public/storefront/{slug}` | name, menuCode, orderingEnabled, business, `data` | `no-store` (saves visible on the next request) |
| `GET /api/public/storefront/{slug}/menu` | collections rendered as returned | `revalidate: 60` |
| `GET /api/public/menu/{menuCode}/products/{id}` | product detail (variants/modifiers) | `revalidate: 60` |

The website renders the returned collections **without re-deriving storefront
rules**. Hidden products, display overrides, category/product ordering,
deduplication and empty-collection omission are the backend's responsibility.
The same rules are implemented in the local fixture builder for development and
tests (`src/lib/caisse212/storefront/menu-builder.ts`).

### Collections semantics

- `data.collections` **absent** → real categories as sections.
- `data.collections: []` → no sections.
- Custom collections → category products first (category order, product name
  order), then explicit `productIds` in order, deduplicated.
- Empty collections are omitted; hidden products are removed.
- Extra collection keys (`badge`, `layout`, …) are preserved and returned as
  `attributes`.

### Dynamic theming

`data.theme.primary` → `--green` / `--storefront-primary`, `secondary` →
`--storefront-secondary`, `font` → `--storefront-font`. Colors are accepted only
as `#rgb`/`#rrggbb`/`#rrggbbaa` literals and logos only as `/path` or http(s)
URLs. Unknown theme/text/social keys are preserved untouched.

`data.texts.heroTitle`, `heroSubtitle`, `footer` and `data.social.*` drive the
homepage, header logo and footer. `orderingEnabled` hides purchase controls and
is **also enforced server-side** by the checkout routes (403
`ordering_disabled`).

## 3. Public unavailable handling

An unknown/inactive storefront returns 404 from `/api/public/storefront/{slug}`.
When the configured slug is 404 the public homepage and menu render a 404,
while an API outage renders an explicit unavailable state rather than silently
switching data sources. Checkout also refuses to submit when the storefront is
unavailable or `orderingEnabled=false` (server-side 403).

## 4. Admin integration

The website admin has its own authenticated session (`/admin/login`, HttpOnly
cookie + CSRF). Storefront management is restricted to the **ADMIN** and
**SUPER_ADMIN** roles: pages redirect operators away and API routes return 403.
All storefront admin routes use `requireStorefrontAdminApi` /
`requireStorefrontAdminMutation` (authentication + role + CSRF + same-origin):

```
GET    /api/admin/storefronts
POST   /api/admin/storefronts
GET    /api/admin/storefronts/{id}
PUT    /api/admin/storefronts/{id}        (full replacement + version++)
DELETE /api/admin/storefronts/{id}        (soft delete, 204)
GET    /api/admin/storefronts/{id}/menu   (saved preview, works when inactive)
POST   /api/admin/storefronts/{id}/menu/preview  ({ data })
GET    /api/admin/storefronts/catalog     (picker catalog provider)
```

`PUT` always sends the complete object (`slug`, `name`, `businessId`,
`allowedOrigins`, `active`, `data`). Team business IDs are immutable after
creation. Unknown `data` keys survive every form edit (deep-cloned updates; the
form never rebuilds `data` from known fields only).

Screens:

- `/admin/websites` — list, search, active toggle (full PUT), copy/open public
  URL, delete confirmation.
- `/admin/websites/new` — create.
- `/admin/websites/{id}/edit` — tabs: Général, Accès (CORS), Sections,
  Produits, Apparence & contenu, Avancé (JSON) + live draft preview.

Server-side validation mirrors the documented constraints: slug 3–63
`[a-z0-9-]` with no edge dash, name ≤120, origins ≤20 exact `http(s)://host[:port]`
or `*` (not mixed), `data` ≤256 KB UTF-8 bytes, section names required,
category/product ids validated against the business catalog, overrides limited
to `name`/`description`/`imageUrl` (prices rejected), unknown keys preserved.
Backend 400/404 `message` values are displayed verbatim.

### Preview

- Saved preview: `GET …/{id}/menu` (uncached, works for inactive storefronts).
- Draft preview: `POST …/{id}/menu/preview` with the shared `data` object,
  debounced 600 ms. A new storefront has no preview until its first save.
- The public menu URL is never used for administration previews.

### Picker catalog provider

V206 does not document category/product listing endpoints, so the pickers use
the website's own Caisse212 catalog mirror (already refreshed by the sync
worker) through the internal `/api/admin/storefronts/catalog` route. This is a
documented **catalog-provider boundary**, not a fabricated Caisse212 endpoint.

- **Fixtures mode** uses deterministic hash ids (the same projection as the
  fixture menu and the checkout bridge).
- **Live mode** uses the real numeric POS ids from the mirror's `externalId`.
  Rows without a numeric external id are hidden from the picker (no guessed
  ids), and id existence is left to the Caisse212 backend for raw JSON edits.

## 5. Cart and ordering

Public menu/detail ids are Caisse212 numeric POS ids. The existing cart stores
string ids and the existing order pipeline validates prices against the catalog
mirror. `src/lib/storefront/cart-bridge.ts` maps numeric ids to mirror records:

- **Fixtures**: deterministic numeric projection of the mirror's `externalId`
  (hash with deterministic collision resolution).
- **Live (assumption)**: `String(numericId) === catalog.externalId`. If an id
  does not match, checkout fails with a clear unavailable-product message; it
  never guesses a price.

The checkout UI, authoritative server-side repricing, price-change approval,
idempotent submission, outbox/POS acceptance and secure tracking token remain
the website's existing Caisse212 order integration
(`docs/CAISSE212_API_CONTRACT.md`).

## 6. Confirmed vs assumed vs blocked

### Confirmed (from the V206 document)

- Public config/menu endpoints and their top-level fields.
- Admin storefront CRUD paths, full PUT replacement, `version` increments,
  soft delete + slug reuse.
- Collections absent/empty/custom semantics, hidden products, display-only
  overrides, extra keys, origins and size limits.
- Saved and unsaved preview endpoints.
- Public 404 for unknown/inactive storefronts; authenticated preview works
  while inactive.
- CORS is a browser boundary, not authentication; public data is public.

### Assumed — requires verification against real responses

1. **Money unit**: prices are treated as integer minor units (centimes), as in
   the rest of this integration. If V206 returns major units, the display and
   cart estimates need a documented conversion.
2. **Product detail schema**: V206 describes variants/modifiers but publishes
   no schema. The adapter (`types.ts`) requires `id`, `name`, optional
   `variants[]` and `modifierGroups[]`; runtime validation rejects mismatches
   rather than fabricating data.
3. **Numeric id ↔ mirror identity**: live checkout assumes storefront numeric
   product/variant/modifier ids equal the catalog mirror `externalId` strings.
4. **Storefront order endpoint**: `POST /api/public/menu/{menuCode}/order` is
   documented as an ordering path but its request/response schema is **not**
   published. It is deliberately not called. The website continues to use its
   documented order adapter; wiring V206 ordering requires the missing schema.
5. **Tracking endpoint**: `/api/public/menu/order/track/{trackingCode}` has no
   documented response/status mapping. The website keeps its own secure
   tracking token page instead.

### Blocked / open items

- The V206 backend routes/controllers are not present in the inspected
  Caisse212 backend, so no live call could be verified from this environment.
- There is no documented Caisse212 admin login/token-exchange flow; the admin
  integration therefore requires server-side credentials supplied by
  operations. Do not expose them via `NEXT_PUBLIC_*`.
- Final live verification checklist: real config/menu/product responses; money
  unit; ordering/tracking contracts; live id mapping; CORS behaviour.

## 7. Error handling

`StorefrontError` carries a code and HTTP status. Admin routes return
`{ ok: false, error }`; the UI displays the message (including backend 400
validation messages) and keeps unsaved state. Public pages show an explicit
unavailable state when the Storefront API is unreachable; they do not silently
switch to fixtures in live mode.

## 8. Tests

- `tests/unit/storefront-validation.test.ts` — slug/origin/size/collection/
  override/unknown-key rules.
- `tests/unit/storefront-menu.test.ts` — absent vs empty collections, ordering,
  dedupe, hidden products, overrides, prices, product detail mapping.
- `tests/integration/storefront-fixtures.test.ts` — public config/menu, inactive
  404, admin CRUD/version/soft delete/slug reuse, invalid ids, price override
  rejection, per-storefront isolation, checkout id bridge.
- `e2e/admin-websites.spec.ts` — create/edit a website in the admin.
- Existing Playwright flows now cover the storefront-driven menu, cart,
  checkout and tracking.
