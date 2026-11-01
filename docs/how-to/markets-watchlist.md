---
diataxis: how-to
use_when: Seed markets allowlist, sync quotes/history, use /markets watchlist
audience: both
related_code:
  - backend/src/domain/marketData.ts
  - backend/src/domain/marketHistory.ts
  - backend/src/domain/yahooHistory.ts
  - backend/src/domain/yahooSymbols.ts
  - backend/src/domain/marketUniverse.ts
  - backend/src/domain/twelveDataClient.ts
  - backend/src/routes/marketsRoutes.ts
  - frontend/src/pages/MarketsPage.tsx
---

# Markets allowlist + watchlist

Hub: [docs/README.md](../README.md).

## Prerequisites

1. From `backend/`: `npm run build`.
2. Optional `TWELVE_DATA_API_KEY` in `backend/.env` — **catalog only** (`market:sync-catalog`). Valuations use Yahoo (no key).
3. `OANOR_API_KEY` is **dormant** for valuations (kept for a future per-user GPW path).

## One-time / occasional setup

```bash
cd backend
npm run market:sync-catalog         # optional: full TD stocks+etfs into Instrument (scope=catalog)
npm run market:seed-universe        # curated S&P500 / GPW / indexes / ETFs allowlisted=true
npm run market:sync-history-yahoo -- --force --range 10y   # EOD closes (Yahoo)
npm run market:sync-quotes -- --force                      # latest Yahoo closes for allowlisted
```

Universe JSON lives in `backend/data/market-universe/` (`historySource: "yahoo"`; no Stooq/TD hints in seed files). Seed also un-allowlists retired tickers (`CIE`, `CMR`, `CCC`, `SPL` — delisted or renamed to `MDV` / `EBP`).

## Quotes vs history

| Source | Role |
|--------|------|
| **Yahoo chart** | **Primary** valuations — quotes (`market:sync-quotes`, soft HTTP when `marketLiveApi`) and history (`market:sync-history-yahoo` / `market:sync-history` → Yahoo). Maps SPX→`^GSPC`, NDX→`^NDX`, GPW equities→`.WA`, WIG indexes→`WIG20.WA` / `MWIG40.WA` / `WIG.WA` |
| Local export | Offline restore via `market:import-history` / demo seed |
| Twelve Data | Catalog sync only (dormant for quotes/history) |
| Oanor GPW / Stooq | Dormant valuation paths (code kept for a future per-user API) |

**Note:** Yahoo chart for `WIG20.WA` / `MWIG40.WA` often exposes only short `validRanges` (latest close works; multi-year history may be a single bar). `WIG.WA` and most equities support long ranges.

`GET /api/watchlist` never calls providers.

## UI

1. **Search markets** — allowlisted only (`scope=allowlist`).
2. **Add instrument** — full catalog (`scope=catalog`) → **Add to markets** (`POST /api/instruments/allowlist`, global).
3. **Watchlist** — favorites with last close; click symbol/name → `/markets/:instrumentId` chart (`GET …/history` with `months` or `year`; soft ~1y Yahoo backfill if sparse and `marketLiveApi` on — no forced full resync; 12s timeout). Chart supports rolling 3/6/12 months or paging calendar years when multi-year closes are stored.

## CLI flags

- `market:sync-quotes --watchlist-only` / `--userId N` / `--force` — Yahoo latest close
- `market:sync-history-yahoo --watchlist-only` / `--userId N` / `--force` / `--range 10y` — Yahoo history (hobby; unofficial API). Space or equals forms work (`--range 10y` or `--range=10y`).
- `market:sync-yahoo-gaps` / `--force` — **daily allowlist gap-fill**: per allowlisted instrument, Yahoo range sized from last valuation date; upserts bars after that day. AppConfig day-lock is set only after a successful/partial-success pass (not after total outage); skips a second run the same UTC day (`--force` overrides). Prefer host cron for production.
- `market:sync-history` — delegates to Yahoo for current universe seeds (legacy Stooq/TD only if a custom seed still sets `historySource`)
- `market:export-history` / `market:import-history` — NDJSON(`.gz`) dump. Default `data/market-history/exports/allowlist-eod.ndjson.gz` (gitignored).
- Demo seed prefers that local export when present; else committed `demo-eod.ndjson`.

## Daily gap-fill (optional)

| Path | How |
|------|-----|
| Host cron | `npm run build && npm run market:sync-yahoo-gaps` (see [private-deploy](private-deploy.md)) |
| In-process | `MARKET_YAHOO_GAP_SYNC=true` (optional `MARKET_YAHOO_GAP_SYNC_UTC_HOUR`, default `21`) — backend polls ~15m after listen |

Prefer a single runner. After a successful pass, the shared day-lock skips further runs the same UTC day (cron + in-process). A total Yahoo outage does not set the lock so the next tick/cron can retry.
