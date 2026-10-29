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

Goal: upsert the demo login and load a **sample portfolio** that showcases shipped features (accounts, categories, cash ledger, internal transfers, statistics, home KPIs).

## Warning

**Re-running the seed wipes all data owned by the demo user** (categories, accounts, cash transactions, transfers), then recreates the sample set. Do not store real personal data under `demo@finance.local`.

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
| `/accounts` | Everyday Checking (BANK/PLN), Euro Travel (BANK/EUR), Brokerage Cash (BROKERAGE/PLN), Crypto Spot (CRYPTO/USD), Everyday Credit Card (CREDIT_CARD/PLN, debt), IKE Brokerage (IKE/PLN cash sleeve) |
| `/categories` | Default roots by ledgerType plus a **demo-only** nest to depth 3 (e.g. Food → Groceries → Supermarket; Salary → Primary job → Base salary; Internal transfer → Investment → Brokerage cash). Empty users still get flat roots only. |
| `/tags` | Cross-cutting trip/project tags (Italy trip 2026, Home renovation, Kids birthday, …) on matching cash expenses — one tag groups spend across many categories |
| `/accounts/:id` | ~24 months of INCOME/EXPENSE rows (≥5 per month per account, including card purchases and light IKE fees/interest); categories + purpose tags on many expenses; read-only `TRANSFER IN/OUT` legs from seeded transfers (with TRANSFER categories) |
| `/transfers` | Same-/cross-currency showcase rows, plus monthly Checking → Credit Card payments (450 PLN) and Checking → IKE contributions (500 PLN) for each ledger month — each transfer tagged with a TRANSFER category |
| `/dashboard` | NBP-converted net-worth buckets + history chart (credit-card debt in liabilities), period KPIs for the selected currency (pick PLN/EUR/USD in top bar; run `fx:sync` if foreign accounts exist) |
| `/statistics` | Period KPIs, cashflow chart, and category breakdown across the seeded history (transfer legs excluded). Donut rolls to **tree roots**; detail starts collapsed at roots — expand Food to see Groceries → Supermarket (rolled-up totals) |

## Notes

- Implementation: [`backend/prisma/seed.ts`](../../backend/prisma/seed.ts) + [`seedDemoPortfolio.ts`](../../backend/src/domain/seedDemoPortfolio.ts).
- Ledger is **deterministic** (PRNG seed `demo-portfolio-v2`): same amounts on every run. Transfers (`buildDemoTransfers`) include showcase rows plus one card payment and one IKE contribution per month. Each account `cashBalance` is opening + signed ledger deltas including transfer legs.
- Password hash is reset to the known demo password on every run.
- Other users in the same database are not modified.
- Hub: [docs/README.md](../README.md).
