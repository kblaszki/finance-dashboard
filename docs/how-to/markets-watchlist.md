---
diataxis: how-to
use_when: Seed markets allowlist, sync quotes/history, use /markets watchlist
audience: both
related_code:
  - backend/src/domain/marketData.ts
  - backend/src/domain/marketHistory.ts
  - backend/src/domain/marketUniverse.ts
  - backend/src/domain/twelveDataClient.ts
  - backend/src/domain/oanorGpwClient.ts
  - backend/src/domain/stooqClient.ts
  - backend/src/routes/marketsRoutes.ts
  - frontend/src/pages/MarketsPage.tsx
---

# Markets allowlist + watchlist

Hub: [docs/README.md](../README.md).

## Prerequisites

1. Keys in `backend/.env` (see `backend/.env.example`):
   - `TWELVE_DATA_API_KEY` — catalog + US/TD history + non-GPW quotes
   - `OANOR_API_KEY` — live GPW quotes
2. From `backend/`: `npm run build`.

## One-time / occasional setup

```bash
cd backend
npm run market:sync-catalog    # full TD stocks+etfs into Instrument (searchable via scope=catalog)
npm run market:seed-universe   # mark curated S&P500 / GPW / indexes / ETFs allowlisted=true
npm run market:sync-history    # ~1y daily closes for allowlisted (TD + Stooq for GPW)
npm run market:sync-quotes     # fresh last close for all allowlisted (default)
```

Universe JSON lives in `backend/data/market-universe/`.

## Quotes vs history

| Source | Role |
|--------|------|
| Twelve Data | Catalog; `/time_series` history; `/quote` for non-GPW |
| Oanor GPW | Live quote for GPW/WSE/Poland (no history API) |
| Stooq CSV | GPW / WIG history backfill |

`GET /api/watchlist` never calls providers.

## UI

1. **Search markets** — allowlisted only (`scope=allowlist`).
2. **Add instrument** — full catalog (`scope=catalog`) → **Add to markets** (`POST /api/instruments/allowlist`, global).
3. **Watchlist** — favorites with last close.

## CLI flags

- `market:sync-quotes --watchlist-only` — old behavior (watchlist only)
- `market:sync-quotes --userId=N` — implies watchlist-only for that user
- `market:sync-history --force` / `--instrumentId=N`
