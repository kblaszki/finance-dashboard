---
diataxis: tutorial
use_when: Create demo user with sample portfolio data
audience: both
related_docs:
  - docs/tutorials/first-run.md
  - docs/how-to/dashboard-and-statistics.md
related_code:
  - backend/prisma/seed.ts
  - backend/src/domain/seedDemoPortfolio.ts
---

# Tutorial: demo user seed

Goal: upsert the demo login and load a **sample portfolio** that showcases shipped features (accounts, categories, cash ledger, statistics).

## Warning

**Re-running the seed wipes all data owned by the demo user** (categories, accounts, cash transactions), then recreates the sample set. Do not store real personal data under `demo@finance.local`.

## Steps

1. Ensure migrations are applied (`cd backend && npx prisma migrate dev` if needed).
2. Run:

```bash
cd backend
npm run db:seed
```

3. Log in: `demo@finance.local` / `demo12345` (username: `demo`).

## What you get

| Surface | Sample content |
|---------|----------------|
| `/accounts` | Everyday Checking (BANK/PLN), Euro Travel (BANK/EUR), Brokerage Cash (BROKERAGE/PLN), Crypto Spot (CRYPTO/USD) |
| `/categories` | Default Income/Expense tree |
| `/accounts/:id` | INCOME/EXPENSE ledger rows; tagged categories + one uncategorized expense |
| `/home` | Cash net-worth buckets + rolling 12m averages (pick PLN) |
| `/statistics` | Period KPIs + chart (pick PLN/EUR) and category breakdown; switch to prior month for Checking history |

## Notes

- Implementation: [`backend/prisma/seed.ts`](../../backend/prisma/seed.ts) + [`seedDemoPortfolio.ts`](../../backend/src/domain/seedDemoPortfolio.ts).
- Password hash is reset to the known demo password on every run.
- Other users in the same database are not modified.
- Hub: [docs/README.md](../README.md).
