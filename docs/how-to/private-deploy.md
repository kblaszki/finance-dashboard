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

Operational checklist for a **private household** instance: closed registration (`ALLOW_REGISTER=false`), users created with CLI, HTTPS terminated on a **host reverse proxy**, app stack in Docker Compose. Basics: [README.md](../../README.md#private-deployment).

## Target topology

Browser → host reverse proxy (TLS) → `127.0.0.1:8080` (`web` nginx) → `api:4000` (internal only) → SQLite under `./data/`.

Compose does **not** issue certificates. Later you could add Caddy/Traefik as another Compose service; this guide assumes TLS stays on the host.

## Host requirements

- Docker Engine + Compose v2
- Reverse proxy with TLS (Caddy, nginx, Traefik, …) pointing at `http://127.0.0.1:8080`
- Persistent directory for the repo checkout (or at least `./data` and `backend/.env`)

## Before go-live (Docker)

| Step | Action |
|------|--------|
| 1 | Copy `backend/.env.production.example` → `backend/.env`; set `JWT_SECRET` (≥32 random characters). |
| 2 | Keep `ALLOW_REGISTER=false` (also forced in `docker-compose.yml`). |
| 3 | `docker compose up -d --build` |
| 4 | Smoke: `curl -sS http://127.0.0.1:8080/api/health` → `{ ok: true, db: true }` |
| 5 | Create household users (repeat per person): `docker compose exec api npm run create-user -- --email you@example.com --username you --password '…'` |
| 6 | Point reverse proxy at `127.0.0.1:8080`; open the HTTPS URL and log in |

`create-user` / `db:backup` run compiled JS from `dist/` (built into the image). Locally without Docker: `cd backend && npm run build` then the same npm scripts.

## Reverse proxy examples

Replace `finance.example.com` with your hostname.

**Caddy**

```caddy
finance.example.com {
  reverse_proxy 127.0.0.1:8080
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
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Same-origin `/api` is proxied by the `web` container — leave `CORS_ORIGIN` unset unless UI and API use different origins.

## Ongoing operations

| Task | Command / notes |
|------|-----------------|
| Health | `GET /api/health` (via HTTPS domain or `127.0.0.1:8080`) |
| Additional users | `docker compose exec api npm run create-user -- --email … --username … --password …` |
| Daily DB backup | `docker compose exec api npm run db:backup` → files in `./data/backups/` (`BACKUP_DIR`). Optional `--gzip` / `BACKUP_GZIP=true`. Sync off-site. |
| Cron example | `0 2 * * * cd /path/to/finance-dashboard && docker compose exec -T api npm run db:backup` |

## Update

```bash
cd /path/to/finance-dashboard
git pull
docker compose up -d --build
curl -sS http://127.0.0.1:8080/api/health
# smoke-test login in the browser
```

Entrypoint runs `prisma migrate deploy` before starting the API.

## Rollback (SQLite)

1. `docker compose stop`
2. Restore `./data/prod.db` from a file under `./data/backups/` (decompress `.gz` if needed)
3. `docker compose up -d`
4. Verify health + login

## Security notes

- Do not commit `backend/.env` or `./data/*.db`.
- API port `4000` is **not** published on the host; only `127.0.0.1:8080` is.
- JWT expiry is 7 days; no refresh tokens.
- Production enables auth rate limits and `trust proxy` (see [environment.md](../reference/environment.md)).

## Related docs

- [architecture.md](../explanation/architecture.md) — auth and request flow
- [environment.md](../reference/environment.md) — env vars
- [scripts.md](../reference/scripts.md) — CLI
- [README.md](../../README.md) — local development and demo user seed
