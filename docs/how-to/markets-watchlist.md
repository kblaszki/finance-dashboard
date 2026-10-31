---
diataxis: how-to
use_when: Sync Twelve Data catalog/quotes, Oanor GPW quotes, and use /markets watchlist
audience: both
related_code:
  - backend/src/domain/marketData.ts
  - backend/src/domain/twelveDataClient.ts
  - backend/src/domain/oanorGpwClient.ts
  - backend/src/routes/marketsRoutes.ts
  - frontend/src/pages/MarketsPage.tsx
---

# Markets watchlist (Twelve Data + Oanor GPW)

Hub: [docs/README.md](../README.md).

## Prerequisites

1. Set keys in `backend/.env` (see `backend/.env.example`):
   - `TWELVE_DATA_API_KEY` — catalog sync + quotes for non-GPW symbols
   - `OANOR_API_KEY` — quotes for GPW / WSE / Poland-listed favorites
2. From `backend/`: `npm run build`.

## Sync catalog (once / occasional)

```bash
cd backend && npm run market:sync-catalog
```

Upserts STOCK + ETF rows into `Instrument` from Twelve Data (~1 credit per list endpoint). Afterward, `/markets` search hits SQLite only. Catalog is **not** from Oanor.

## Sync last close for favorites

```bash
cd backend && npm run market:sync-quotes
# optional: --userId=1  --force
```

- **GPW / WSE / country Poland** → Oanor `GET /v1/quote` (batches ≤20; paced ~2 req/s). Stored as `InstrumentValuation.source = oanor_gpw` (live last price as `close`).
- **Other exchanges** → Twelve Data EOD (paced ~8 credits/min). Source `twelve_data`.

HTTP `GET /api/watchlist` never calls either provider.

## UI

1. Open **Markets** in the shell (`/markets`).
2. Search by symbol or name → **Add**.
3. On add, the API tries one quote if the valuation is missing/stale; failure keeps the favorite with no close.
4. Reload the page — list reads DB only (no new credits).

## Limits

- Twelve Data Free Basic: US-heavy quotes, daily credit cap. LSE and many non-US names may stay without a close.
- Oanor GPW Free: ~16 500 calls/month, 2 req/s (see provider pricing). Covers Poland listings such as `ETFBW20TR`.
