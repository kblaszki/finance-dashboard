---
diataxis: reference
use_when: Run CLI scripts — backup, create-user, market sync, migrations
audience: both
related_docs:
  - docs/reference/environment.md
  - docs/how-to/private-deploy.md
  - docs/how-to/market-data-sync.md
  - docs/how-to/add-prisma-model.md
related_code:
  - backend/src/scripts/
  - backend/docker-entrypoint.sh
---

# Scripts and migrations

Hub: [docs/README.md](../README.md).

Run from `backend/` unless noted. Env: [environment.md](environment.md).

## npm scripts (`backend/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `db:backup` | `tsx src/scripts/backupDb.ts` | Copy SQLite file to backup dir |
| `create-user` | `tsx src/scripts/createUser.ts` | Create user when register is closed |
| `market:sync` | `tsx src/scripts/marketSync.ts` | Twelve Data EOD + FX history |

Root `npm run db:seed` / demo: [demo-seed.md](../tutorials/demo-seed.md).

### `db:backup`

```bash
cd backend && npm run db:backup
cd backend && npm run db:backup -- --gzip
```

- Source: `DATABASE_URL` resolved path.
- Dest: `$BACKUP_DIR` (default `backups/`), file `finance-YYYYMMDD-HHmm.db` or `.db.gz`.
- Gzip: `--gzip` flag or `BACKUP_GZIP=true`.

### `create-user`

```bash
cd backend && npm run create-user -- --email you@example.com --username you --password '…'
```

Requires all three flags. Password rules: `validatePassword` in `auth.ts`. Fails if email exists.

### `market:sync`

```bash
cd backend && npm run market:sync
```

- Needs `MARKET_DATA_API_KEY`.
- `MARKET_BACKFILL_DAYS` (default 90) controls CLI backfill window.
- Exit code 1 if sync reports errors. HTTP alternative: [market-data-sync.md](../how-to/market-data-sync.md).

## Prisma migrations

| Context | Command |
|---------|---------|
| Local schema change | `cd backend && npx prisma migrate dev --name <description>` — [add-prisma-model.md](../how-to/add-prisma-model.md) |
| Production / Docker | `npx prisma migrate deploy` (no new migration files) |

Docker entrypoint (`backend/docker-entrypoint.sh`):

1. `mkdir -p /app/data`
2. `npx prisma migrate deploy`
3. `exec node dist/app.js`

Do not run `migrate dev` in production containers — it is interactive and may reset data.

## Related

- [private-deploy.md](../how-to/private-deploy.md)
- [environment.md](environment.md)
