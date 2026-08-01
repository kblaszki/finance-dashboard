---
diataxis: reference
use_when: Env vars, rate limits, production guards
audience: both
related_code:
  - backend/src/authConfig.ts
  - backend/src/app.ts
  - backend/.env.example
---

# Environment reference

Hub: [docs/README.md](../README.md).

## Required / common

| Variable | Role |
|----------|------|
| `DATABASE_URL` | SQLite URL (default `file:./dev.db`) |
| `JWT_SECRET` | ≥32 characters; signs JWTs |
| `PORT` | API port (default 4000) |
| `ALLOW_REGISTER` | `true`/`false` — open registration |
| `NODE_ENV` | `production` enables auth rate limits and stricter startup checks |

## Optional

| Variable | Role |
|----------|------|
| `CORS_ORIGIN` | Restrict CORS origin when set |
| `JSON_BODY_LIMIT` | Express JSON body limit (default `1mb`) |
| `BACKUP_DIR` / `BACKUP_GZIP` | Used by `npm run db:backup` |

## Production guards

`assertProductionEnvironment` (`authConfig.ts`): when `NODE_ENV=production`, requires a long `JWT_SECRET` and `ALLOW_REGISTER=false`.

## Rate limits

When `NODE_ENV=production`, Express rate-limits `POST /api/auth/login` and `POST /api/auth/register` (15 min window, 30 requests).

## Frontend

| Variable | Role |
|----------|------|
| `VITE_API_BASE_URL` | API base URL; empty in production builds that proxy `/api`; in Vite DEV defaults to `http://localhost:4000` if unset |

Template: `backend/.env.example` may still list unused market-data keys from earlier product versions — they are not consumed by the auth baseline.
