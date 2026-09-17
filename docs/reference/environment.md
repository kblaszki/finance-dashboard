---
diataxis: reference
use_when: Env vars, rate limits, production guards
audience: both
related_code:
  - backend/src/authConfig.ts
  - backend/src/httpConfig.ts
  - backend/src/app.ts
  - backend/.env.example
  - .env.example
---

# Environment reference

Hub: [docs/README.md](../README.md).

## Required / common

| Variable | Role |
|----------|------|
| `DATABASE_URL` | SQLite URL (local default `file:./dev.db`; Docker `file:/data/finance.db`) |
| `JWT_SECRET` | ≥32 characters; signs JWTs |
| `PORT` | Listen port (code default 4000; Docker image `3000`) |
| `ALLOW_REGISTER` | `true`/`false` — open registration |
| `NODE_ENV` | `production` enables auth rate limits, Helmet, closed CORS, and stricter startup checks |

## Optional

| Variable | Role |
|----------|------|
| `CORS_ORIGIN` | Restrict CORS when set; in production, unset means CORS off (same-origin) |
| `APP_ORIGIN` | Fallback CORS origin if `CORS_ORIGIN` is empty |
| `JSON_BODY_LIMIT` | Express JSON body limit (default `1mb`) |
| `BACKUP_DIR` / `BACKUP_GZIP` | Used by `npm run db:backup` (Compose: `BACKUP_DIR=/data/backups`) |
| `TRUST_PROXY` | Express trust-proxy hops: unset → `1` in production / off otherwise; `false`/`0`/`no` disables; integer = hop count |
| `STATIC_DIR` | Directory of the Vite build (`index.html`); Docker sets `/app/public` |
| `DOCKER_NETWORK` | Compose only: existing Docker network name for the reverse proxy (default `proxy`). Set in `.env`; not an app secret |

## Production guards

`assertProductionEnvironment` (`authConfig.ts`): when `NODE_ENV=production`, requires a long `JWT_SECRET` and `ALLOW_REGISTER=false`.

## Trust proxy

`resolveTrustProxySetting` (`authConfig.ts`) feeds `app.set("trust proxy", …)` so auth rate limits see the real client IP from `X-Forwarded-For` when a reverse proxy forwards headers.

## Rate limits

When `NODE_ENV=production`, Express rate-limits `POST /api/auth/login` and `POST /api/auth/register` (15 min window, 30 requests).

## Frontend

| Variable | Role |
|----------|------|
| `VITE_API_BASE_URL` | API base URL; empty in production builds (same-origin `/api`); in Vite DEV defaults to `http://localhost:4000` if unset |

Docker production template: [`.env.example`](../../.env.example). Local API: [`backend/.env.example`](../../backend/.env.example). Unused market-data keys in the backend template are not consumed by the auth baseline.
