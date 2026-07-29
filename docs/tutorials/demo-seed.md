---
diataxis: tutorial
use_when: Load demo user and sample portfolio with real EOD prices
audience: both
related_docs:
  - docs/how-to/brokerage-and-fx.md
related_code:
  - backend/prisma/seed.ts
  - backend/prisma/demo/
---

# Tutorial: demo seed

Goal: seed a demo user with ~2 years of sample history. Requires `MARKET_DATA_API_KEY` in `backend/.env` (Twelve Data).

## Steps

1. Ensure migrations are applied (`cd backend && npx prisma migrate dev` if needed).
2. Set `MARKET_DATA_API_KEY` in `backend/.env`.
3. Run:

```bash
cd backend
npm run db:seed
```

4. Log in: `demo@finance.local` / `demo12345` (username: `demo`).

## What you get

- BANK (PLN), brokerage accounts (GPW/US/EU), IKZE, gold, real estate, liabilities, budgets, tax helpers.
- Prices use `source: twelve_data` (same path as live market sync). Free tier rate limits apply (~2–3 minutes).

## Notes

- Re-seed wipes demo user data and cleans demo `InstrumentValuation` rows.
- Symbol mapping must match `backend/src/marketDataSymbols.ts`.
- Orchestration: `backend/prisma/seed.ts` + `backend/prisma/demo/`.

More detail: [README.md](../../README.md) (Demo data section). Hub: [docs/README.md](../README.md).
