---
diataxis: reference
use_when: Look up env vars, production guards, or rate limits
audience: both
related_docs:
  - docs/how-to/private-deploy.md
  - docs/reference/scripts.md
  - docs/explanation/architecture.md
related_code:
  - backend/src/app.ts
  - backend/src/authConfig.ts
  - backend/.env.example
---

# Environment and production guards

Hub: [docs/README.md](../README.md).

Operational settings for the Express backend. Task recipes: [private-deploy.md](../how-to/private-deploy.md). CLI: [scripts.md](scripts.md).

## Environment variables

| Variable | Required | Default / notes |
|----------|----------|-----------------|
| `DATABASE_URL` | Yes (prod) | SQLite URL, e.g. `file:./dev.db` |
| `JWT_SECRET` | Yes | ≥32 characters; signs JWTs |
| `ALLOW_REGISTER` | Prod: must be `false` | Unset → registration **enabled** (dev default) |
| `PORT` | No | `4000` |
| `NODE_ENV` | Prod: `production` | Triggers prod guards + rate limits |
| `CORS_ORIGIN` | No | If set, CORS restricted to that origin; else open `cors()` |
| `JSON_BODY_LIMIT` | No | `1mb` — import CSVs are JSON body text |
| `MARKET_DATA_API_KEY` | For sync/seed | Twelve Data; see [market-data-sync](../how-to/market-data-sync.md) |
| `MARKET_BACKFILL_DAYS` | No | CLI `market:sync` default `90` |
| `BACKUP_DIR` | No | Relative to cwd; default `backups` |
| `BACKUP_GZIP` | No | `true` enables gzip without `--gzip` flag |

Template: `backend/.env.example`. Never commit `backend/.env`.

## Production startup (`assertProductionEnvironment`)

When `NODE_ENV=production` (`authConfig.ts`):

1. `JWT_SECRET` must be set and ≥32 chars.
2. `ALLOW_REGISTER` must be exactly closed (`false`) — create users with `npm run create-user` ([scripts.md](scripts.md)).

Called from `app.ts` before routers mount.

## Rate limits (production only)

Applied only when `NODE_ENV === "production"` (`app.ts`):

| Mount | Window | Max |
|-------|--------|-----|
| `/api/auth/login` | 15 minutes | 30 |
| `/api/auth/register` | 15 minutes | 30 |
| `/api/import` | 1 minute | 10 |

Dev/test do not enable these limiters. Standard `RateLimit-*` headers via `express-rate-limit`.

## Related

- Auth flow: [architecture.md](../explanation/architecture.md)
- Private deploy checklist: [private-deploy.md](../how-to/private-deploy.md)
