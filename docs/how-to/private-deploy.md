---
diataxis: how-to
use_when: Private single-user deployment checklist
audience: both
related_docs:
  - docs/explanation/architecture.md
  - docs/reference/environment.md
---

# Private deployment checklist

Hub: [docs/README.md](../README.md).

Operational checklist for a **single-user private** instance (no open registration). Basics: [README.md](../../README.md#private-deployment).

## Before go-live

| Step | Action |
|------|--------|
| 1 | Copy `backend/.env.example` → `backend/.env`; set `JWT_SECRET` (≥32 characters). |
| 2 | Set `ALLOW_REGISTER=false` to hide registration and block `POST /api/auth/register`. |
| 3 | Create the sole user: `cd backend && npm run create-user -- --email you@example.com --username you --password '…'`. |
| 4 | Run `npm run dev` or deploy via Docker (see README). Verify `GET /api/health` → `{ ok: true, db: true }`. |

## Ongoing operations

| Task | Command / endpoint |
|------|-------------------|
| Daily DB backup | `cd backend && npm run db:backup` — files under `backend/backups/` (or `BACKUP_DIR`). Optional `--gzip` / `BACKUP_GZIP=true`. |
| Health check | `GET /api/health` |
| Additional users | Only when `ALLOW_REGISTER=true`; otherwise `npm run create-user`. |

## Docker (optional)

```bash
cp backend/.env.production.example backend/.env
# edit JWT_SECRET
docker compose up -d --build
docker compose exec api npm run create-user -- --email you@example.com --username you --password 'secret'
```

UI: `http://localhost:8080` (nginx proxies `/api` to the API). Database and backups persist in `./data/`.

## Security notes

- Do not commit `backend/.env` or `*.db` files.
- JWT expiry is 7 days; no refresh tokens.
- Auth-only baseline: no shared instrument catalog in this codebase yet.

## Related docs

- [architecture.md](../explanation/architecture.md) — auth and request flow
- [README.md](../../README.md) — local development and demo user seed
