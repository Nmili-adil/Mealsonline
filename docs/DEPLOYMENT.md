# Deployment Guide

## Target

Independent deployment on a VPS or Node.js hosting (Node 20.9+).

## 1. Environment

```bash
cp .env.example .env
# fill DATABASE_URL (MySQL), AUTH_SECRET, CAISSE212_* variables
```

Production must use:

```env
DATABASE_URL="mysql://user:password@localhost:3306/mealsonline"
AUTH_SECRET="<openssl rand -hex 32>"
CAISSE212_MODE="live"          # mock is refused in production
CAISSE212_BASE_URL="https://pos.example.com"
CAISSE212_CLIENT_ID="..."
CAISSE212_CLIENT_SECRET="..."
CAISSE212_WEBHOOK_SECRET="<openssl rand -hex 32>"
```

Switch `prisma/schema.prisma` to `provider = "mysql"`.

## 2. Build and migrate

```bash
npm ci
npm run db:deploy     # apply Prisma migrations
npm run db:seed       # optional initial admin/catalog (set ADMIN_* vars first)
npm run build
```

## 3. Processes

```bash
# Web server
npm run start -- -p 3000

# Outbox worker (order submission + reconciliation)
npm run worker

# Scheduled catalog sync
npm run sync-worker
```

Run the workers under a process supervisor (`systemd`, `pm2`, Docker
`restart: unless-stopped`). They are safe to run with multiple instances:
outbox claiming uses `updateMany` with a status guard, so only one process
owns a row.

Example systemd units are out of scope here but standard: one service for
`next start`, one for `npm run worker`, one for `npm run sync-worker`.

## 4. Reverse proxy + HTTPS

Nginx example:

```nginx
server {
  listen 443 ssl http2;
  server_name mealsonline.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

Webhooks: expose only `/api/webhooks/caisse212` to the internet; keep
`/api/admin/*` reachable but protected by session auth.

## 5. Health checks

- Web: `GET /` (200) and `GET /api/menu` (200).
- Admin health: `GET /api/admin/integrations/status` (requires session).
- Worker liveness: process supervisor restarts on exit; workers log heartbeats.

## 6. Database backup & recovery

```bash
# MySQL
mysqldump --single-transaction mealsonline > backup-$(date +%F).sql
# restore
mysql mealsonline < backup-YYYY-MM-DD.sql
```

Backup before migrations. Keep the outbox/inbox tables consistent with the
orders table (they are written transactionally).

## 7. Worker concurrency & locking

- Outbox claim: `updateMany` where status IN (pending, failed) — atomic.
- Sync runs record `MenuSyncRun` rows; overlapping runs are harmless because
  upserts are idempotent. Run a single `sync-worker` per environment unless
  you configure distributed locking.

## 8. Rollout checklist

- [ ] MySQL provisioned + `db:deploy`
- [ ] `.env` with real secrets (never committed)
- [ ] `next build` passes
- [ ] Web, outbox worker, sync worker supervised
- [ ] HTTPS + domain + webhook URL shared with the Caisse212 partner
- [ ] Mock mode disabled (`CAISSE212_MODE=live`)
