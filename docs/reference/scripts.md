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
| Demo user seed | `npm run db:seed` | Upsert `demo@finance.local` and wipe/rebuild sample portfolio (categories, accounts, cash txs) **and** seed EUR/USD FX via NBP (or offline monthly fixture fallback) + markets history fixture |
| NBP FX sync | `npm run fx:sync` | Upsert NBP table A mids for **EUR** and **USD** into `FxRateDaily`. Default last 30 UTC days; or `--days N` / `--from YYYY-MM-DD --to YYYY-MM-DD`. Demo seed already runs a long-window sync (fallback if offline). Manual backfill still useful outside seed: `npm run fx:sync -- --days 760`. Requires `npm run build`. Optional `NBP_API_BASE`. Dashboard/net-worth HTTP never fetches NBP live |
| Market catalog sync | `npm run market:sync-catalog` | Upsert Twelve Data `/stocks` + `/etfs` into `Instrument`. Requires `TWELVE_DATA_API_KEY` + build. Used by catalog search (`scope=catalog`) |
| Market seed universe | `npm run market:seed-universe` | Mark curated S&P 500 / GPW / indexes / ETFs `allowlisted=true` from `backend/data/market-universe/`; un-allowlists retired tickers (`CIE`, `CMR`, `CCC`, `SPL`) |
| Market quote sync | `npm run market:sync-quotes` | Default: all **allowlisted** via **Yahoo** latest close. `--watchlist-only` or `--userId N`; optional `--force` |
| Market history sync | `npm run market:sync-history` | Allowlist history; with universe `historySource: yahoo` (default) uses Yahoo chart (~1y). Prefer `market:sync-history-yahoo` for explicit `--range` |
| Market history Yahoo | `npm run market:sync-history-yahoo` | Primary Yahoo chart closes (`--range 1y` \| `--range 10y` or `--range=10y`, default `1y`; `--watchlist-only`, `--userId N`, `--instrumentId N`, `--force`). Source `yahoo` |
| Market Yahoo gap-fill | `npm run market:sync-yahoo-gaps` | Allowlist: fetch Yahoo closes after each instrument’s latest valuation (`5d`/`1mo`/`3mo`/`1y` by gap). Day-lock once per UTC day; `--force` re-runs. Requires build |
| Market history export | `npm run market:export-history` | Allowlist valuations → NDJSON/`.gz` (`--out PATH`, `--months N`, `--monthly`, `--watchlist-only`). Default `data/market-history/exports/allowlist-eod.ndjson.gz` (gitignored) |
| Market history import | `npm run market:import-history` | Import NDJSON/`.gz` into `InstrumentValuation` (`--file PATH`). Skips unknown instruments |
| DB reset | `npm run db:reset` | `prisma migrate reset --force` — wipe SQLite, migrate, run seed (cash demo). Re-run catalog/universe + `db:seed` for Markets fixture |
| DB backup | `npm run db:backup` | Copy SQLite file (optional `--gzip` / `BACKUP_GZIP`). Requires build; Docker writes under `BACKUP_DIR` (Compose: `/data/backups` → `./data/backups`) |
| Migrate deploy | `npx prisma migrate deploy` | Apply migrations (CI / production) |
| Migrate dev | `npx prisma migrate dev --name <description>` | Local schema change |
| Dev server | `npm run dev` | `ts-node-dev` API |
| Build | `npm run build` | `tsc` |

Root: `npm run dev` runs backend + frontend; `npm test` / `npm run test:coverage` — [testing.md](testing.md).
