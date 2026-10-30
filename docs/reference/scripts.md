---
diataxis: reference
use_when: CLI scripts and prisma migrate deploy
audience: both
related_code:
  - backend/src/scripts/createUser.ts
  - backend/src/scripts/backupDb.ts
  - backend/src/scripts/syncFxRates.ts
  - backend/src/scripts/syncMarketCatalog.ts
  - backend/src/scripts/syncMarketQuotes.ts
  - backend/prisma/seed.ts
  - backend/src/domain/seedDemoPortfolio.ts
---

# Scripts reference

Hub: [docs/README.md](../README.md).

Run from `backend/` unless noted.

| Script | Command | Purpose |
|--------|---------|---------|
| Create user | `npm run create-user -- --email … --username … --password …` | Private deploy when registration is closed; creates an empty user (no default categories/tags). Requires `npm run build` first (runs `dist/scripts/…`). In Docker: `docker compose exec finance-dashboard node dist/scripts/createUser.js --email … --username … --password …` |
| Demo user seed | `npm run db:seed` | Upsert `demo@finance.local` and wipe/rebuild sample portfolio (categories, 4 accounts, cash txs) |
| NBP FX sync | `npm run fx:sync` | Upsert NBP table A mids for **EUR** and **USD** into `FxRateDaily`. Default last 30 UTC days; or `--days N` / `--from YYYY-MM-DD --to YYYY-MM-DD`. For dashboard net-worth history (up to 24 months), run an initial backfill such as `npm run fx:sync -- --days 760`, then keep a short rolling window for daily sync. Requires `npm run build`. Optional `NBP_API_BASE`. Dashboard/net-worth HTTP never fetches NBP live |
| Market catalog sync | `npm run market:sync-catalog` | Upsert Twelve Data `/stocks` + `/etfs` into global `Instrument` (~2 credits). Requires `TWELVE_DATA_API_KEY` and `npm run build`. Search on `/markets` is local-only afterward |
| Market quote sync | `npm run market:sync-quotes` | EOD quote for instruments on any watchlist (or `--userId=N`); optional `--force`. Requires key + build. `GET /api/watchlist` reads DB only |
| DB backup | `npm run db:backup` | Copy SQLite file (optional `--gzip` / `BACKUP_GZIP`). Requires build; Docker writes under `BACKUP_DIR` (Compose: `/data/backups` → `./data/backups`) |
| Migrate deploy | `npx prisma migrate deploy` | Apply migrations (CI / production) |
| Migrate dev | `npx prisma migrate dev --name <description>` | Local schema change |
| Dev server | `npm run dev` | `ts-node-dev` API |
| Build | `npm run build` | `tsc` |

Root: `npm run dev` runs backend + frontend; `npm test` / `npm run test:coverage` — [testing.md](testing.md).
