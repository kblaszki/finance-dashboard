---
diataxis: how-to
use_when: Sync Twelve Data catalog/quotes and use /markets watchlist
audience: both
related_code:
  - backend/src/domain/marketData.ts
  - backend/src/domain/twelveDataClient.ts
  - backend/src/routes/marketsRoutes.ts
  - frontend/src/pages/MarketsPage.tsx
---

# Markets watchlist (Twelve Data)

Hub: [docs/README.md](../README.md).

## Prerequisites

1. Set `TWELVE_DATA_API_KEY` in `backend/.env` (see `backend/.env.example`).
2. From `backend/`: `npm run build`.

## Sync catalog (once / occasional)

```bash
cd backend && npm run market:sync-catalog
```

Upserts STOCK + ETF rows into `Instrument` (~1 credit per list endpoint). Afterward, `/markets` search hits SQLite only.

## Sync last close for favorites

```bash
cd backend && npm run market:sync-quotes
# optional: --userId=1  --force
```

Fetches EOD for instruments on any watchlist (paced for free-tier ~8 credits/min). HTTP list watchlist never calls Twelve Data.

## UI

1. Open **Markets** in the shell (`/markets`).
2. Search by symbol or name → **Add**.
3. On add, the API tries one quote if the valuation is missing/stale; failure keeps the favorite with no close.
4. Reload the page — list reads DB only (no new credits).

## Limits

Free Basic plans are US-heavy on quotes and credit-capped (~800/day). Non-US symbols may stay without a close until the plan covers them.
