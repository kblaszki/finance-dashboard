---
diataxis: how-to
use_when: Run or troubleshoot Twelve Data EOD market sync
audience: both
related_docs:
  - docs/explanation/architecture.md
  - docs/how-to/brokerage-and-fx.md
related_code:
  - backend/src/marketData/
  - backend/src/scripts/marketSync.ts
  - backend/src/routes/marketDataRoutes.ts
---

# Market data sync

Hub: [docs/README.md](../README.md).

## Prerequisites

1. Set `MARKET_DATA_API_KEY` in `backend/.env` (Twelve Data).
2. Held instruments must be STOCK/ETF with a mapped exchange, or crypto pairs on `CRYPTO` accounts.
3. Unmapped BOND/FUND/exchanges are skipped — use manual valuations.

## Run sync

1. HTTP: `POST /api/market-data/sync` — optional body `{ backfillDays? }` (default backfill since 2020 for ever-bought symbols).
2. CLI: `cd backend && npm run market:sync` (cron-friendly weekdays after close).
3. Status: `GET /api/market-data/status` — last sync, held count, stale count (UI: `MarketPricesStatus`).
4. Upserts `InstrumentValuation` with `source: twelve_data` and recomputes affected account snapshots; also refreshes NBP FX history via `fxHistorySync`.

## Symbol mapping and failures

- Mapping: `backend/src/marketData/marketDataSymbols.ts` (GPW → `:GPW`, XETRA → `:XETR`, …).
- Trigger/epoch helpers coordinate runs: `marketDataTrigger.ts`, `marketDataEpoch.ts`.
- If sync reports skips: check instrument type/exchange, API key quota, and pair format for crypto (`BTC/USD`).

Architecture overview: [architecture.md — Market data](../explanation/architecture.md#market-data-eod).
