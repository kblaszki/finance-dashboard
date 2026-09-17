---
diataxis: how-to
use_when: Private household deployment behind reverse proxy with Docker Compose
audience: both
related_docs:
  - docs/explanation/architecture.md
  - docs/reference/environment.md
  - docs/reference/scripts.md
---

# Private deployment checklist

Hub: [docs/README.md](../README.md).

Operational checklist for a **private household** instance: closed registration (`ALLOW_REGISTER=false`), users created with CLI, HTTPS terminated on a reverse proxy, **one** Compose service serving API + SPA. Basics: [README.md](../../README.md#private-deployment).

## Target topology

Browser → reverse proxy (TLS) → `finance-dashboard:3000` (Docker DNS, no host port) → Express (`/api` + Vite static) → SQLite under `./data/` (`file:/data/finance.db` in the container).

Compose does **not** issue certificates. Point Caddy, nginx, or Traefik at the container name on the shared Docker network. Do not publish port `3000` on `0.0.0.0`.

## Host requirements

- Docker Engine + Compose v2
- Reverse proxy with TLS on an **existing** Docker network (set `DOCKER_NETWORK` in `.env` to that network’s name)
- A directory for `compose.yml`, `.env`, and `./data`

## Before go-live (Docker)

| Step | Action |
|------|--------|
| 1 | Copy `.env.example` → `.env`. Set `JWT_SECRET` (≥32 random characters) and `DOCKER_NETWORK` to your proxy network. Keep `ALLOW_REGISTER=false`. |
| 2 | `chmod 600 .env` and `chmod 700 data` (create `data/` if needed). |
| 3 | `docker compose build --pull && docker compose up -d` |
| 4 | Smoke: `GET /api/health` via your HTTPS hostname → `{ ok: true, db: true }` |
| 5 | Create household users (repeat per person): `docker compose exec finance-dashboard node dist/scripts/createUser.js --email you@example.com --username you --password '…'` |
| 6 | Confirm `docker ps` does **not** show `0.0.0.0:3000`. Open the HTTPS URL and log in |

`create-user` / `db:backup` run compiled JS from `dist/` (built into the image). Locally without Docker: `cd backend && npm run build` then the same npm scripts.

Local image check (no proxy network required): `docker build -t finance-dashboard:local .`

## Reverse proxy examples

Replace `finance.example.com` with your hostname. The proxy must share `DOCKER_NETWORK` with this Compose project.

**Caddy**

```caddy
finance.example.com {
  reverse_proxy finance-dashboard:3000
}
```

**nginx**

```nginx
server {
  listen 443 ssl http2;
  server_name finance.example.com;
  # ssl_certificate …;
  # ssl_certificate_key …;

  location / {
    proxy_pass http://finance-dashboard:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Same-origin: Express serves the SPA, so leave `CORS_ORIGIN` / `APP_ORIGIN` unset unless UI and API use different origins.

## Ongoing operations

| Task | Command / notes |
|------|-----------------|
| Health | `GET /api/health` (via HTTPS domain) |
| Additional users | `docker compose exec finance-dashboard node dist/scripts/createUser.js --email … --username … --password …` |
| Daily DB backup | `docker compose exec finance-dashboard npm run db:backup` → files in `./data/backups/` (`BACKUP_DIR=/data/backups`). Optional `--gzip` / `BACKUP_GZIP=true`. Sync off-site. |
| Cron example | `0 2 * * * cd /path/to/compose-project && docker compose exec -T finance-dashboard npm run db:backup` |

## Update

```bash
cd /path/to/compose-project
git pull
docker compose build --pull && docker compose up -d
# GET /api/health via HTTPS
# smoke-test login in the browser
```

Entrypoint runs `prisma migrate deploy` before starting Node. Back up `data/` before migrating.

## Rollback (SQLite)

1. `docker compose stop`
2. Restore `./data/finance.db` (and `-wal`/`-shm` if present) from a file under `./data/backups/` (decompress `.gz` if needed)
3. `docker compose up -d`
4. Verify health + login

## UID and bind mounts

The image runs as UID **1001**. If SQLite hits `EACCES` on `./data`, `chown` that directory on the host or uncomment `user: "1000:1000"` in `compose.yml`.

## Security notes

- Do not commit `.env` or `./data/*.db`.
- Do not publish container port `3000` on `0.0.0.0`.
- JWT expiry is 7 days; no refresh tokens.
- Production enables auth rate limits, Helmet, and `trust proxy` (see [environment.md](../reference/environment.md)).

## Related docs

- [architecture.md](../explanation/architecture.md) — auth and request flow
- [environment.md](../reference/environment.md) — env vars
- [scripts.md](../reference/scripts.md) — CLI
- [README.md](../../README.md) — local development and demo user seed
