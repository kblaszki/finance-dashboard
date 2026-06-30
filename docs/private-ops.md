# Private deployment checklist

Operational checklist for running finance-dashboard as a **single-user private** instance (no open registration). Setup basics: [README.md](../README.md#private-deployment).

## Before go-live

| Step | Action |
|------|--------|
| 1 | Copy `backend/.env.example` → `backend/.env`; set `JWT_SECRET` (≥32 characters). |
| 2 | Set `ALLOW_REGISTER=false` to hide registration and block `POST /api/auth/register`. |
| 3 | Create the sole user: `cd backend && npm run create-user -- --email you@example.com --username you --password '…'`. |
| 4 | Optional: set `MARKET_DATA_API_KEY` for EOD price sync (STOCK/ETF). |
| 5 | Run `npm run dev` or deploy via Docker (see README). Verify `GET /api/health` → `{ ok: true, db: true }`. |

## Ongoing operations

| Task | Command / endpoint |
|------|-------------------|
| Daily DB backup | `cd backend && npm run db:backup` — files in `backend/backups/` (`finance-YYYYMMDD-HHmm.db`). Use `--gzip` or `BACKUP_GZIP=true` to compress. Sync off-site manually. |
| Market price sync | `cd backend && npm run market:sync` or dashboard **Sync prices now**. Schedule weekdays if needed (e.g. cron `0 22 * * 1-5`). |
| Health check | `GET /api/health` |
| Create additional users | Only when `ALLOW_REGISTER=true`; otherwise use `npm run create-user`. |

## Docker (optional)

```bash
cp backend/.env.production.example backend/.env
# edit JWT_SECRET, MARKET_DATA_API_KEY
docker compose up -d --build
docker compose exec api npm run create-user -- --email you@example.com --username you --password 'secret'
```

UI: `http://localhost:8080` (nginx proxies `/api` to the API). Database and backups persist in `./data/`.

## Security notes

- Do not commit `backend/.env` or `*.db` files.
- The `Instrument` catalog is **shared globally** in the database; manual valuations recompute **only the caller's accounts** (see [domain.md](domain.md)). Intended for single-user private use; multi-tenant hosting needs a separate product decision.
- JWT expiry is 7 days; no refresh tokens.

## Related docs

- [architecture.md](architecture.md) — auth and request flow
- [README.md](../README.md) — local development and demo seed
