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

Universe JSON lives in `backend/data/market-universe/`. Seed also un-allowlists retired tickers (`CIE`, `CMR`, `CCC`, `SPL` — delisted or renamed to `MDV` / `EBP`).

## Quotes vs history

| Source | Role |
|--------|------|
| **Yahoo chart** | **Primary** valuations — quotes (`market:sync-quotes`, soft HTTP when `marketLiveApi`) and history (`market:sync-history-yahoo`). Maps SPX→`^GSPC`, NDX→`^NDX`, GPW equities→`.WA`, WIG indexes→`WIG20.WA` / `MWIG40.WA` / `WIG.WA` |
| Twelve Data | Catalog sync only (dormant for quotes/history) |
| Oanor GPW / Stooq | Dormant valuation paths (code kept for a future per-user API) |

**Note:** Yahoo chart for `WIG20.WA` / `MWIG40.WA` often exposes only short `validRanges` (latest close works; multi-year history may be a single bar). `WIG.WA` and most equities support long ranges.

`GET /api/watchlist` never calls providers.

## UI

1. **Search markets** — allowlisted only (`scope=allowlist`).
2. **Add instrument** — full catalog (`scope=catalog`) → **Add to markets** (`POST /api/instruments/allowlist`, global).
3. **Watchlist** — favorites with last close; click symbol/name → `/markets/:instrumentId` chart (`GET …/history` with `months` or `year`; soft ~1y Yahoo backfill if sparse and `marketLiveApi` on). Chart supports rolling 3/6/12 months or paging calendar years when multi-year closes are stored.

## CLI flags

- `market:sync-quotes --watchlist-only` / `--userId N` / `--force` — Yahoo latest close
- `market:sync-history-yahoo --watchlist-only` / `--userId N` / `--force` / `--range 10y` — Yahoo history (hobby; unofficial API). Space or equals forms work (`--range 10y` or `--range=10y`).
- `market:sync-history` — **dormant** TD/Stooq path (prefer Yahoo)
- `market:export-history` / `market:import-history` — NDJSON(`.gz`) dump. Default `data/market-history/exports/allowlist-eod.ndjson.gz` (gitignored).
- Demo seed prefers that local export when present; else committed `demo-eod.ndjson`.
