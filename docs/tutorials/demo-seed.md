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
  - backend/src/domain/seedDemoAssetTrades.ts
---

# Tutorial: demo user seed

Goal: upsert the demo login and load a **sample portfolio** that showcases shipped features (accounts, categories, cash ledger, internal transfers, statistics, home KPIs).

## Warning

**Re-running the seed wipes all data owned by the demo user** (categories, accounts, cash transactions, transfers), then recreates the sample set. Do not store real personal data under `demo@finance.local`.

## Steps

### Full local DB wipe (test database)

```bash
cd backend
npm run db:reset          # migrate reset --force (wipe + migrate + seed cash demo)
npm run build
npm run market:sync-catalog
npm run market:seed-universe
npm run db:seed           # re-attach markets fixture onto demo watchlist
```

`seedDemoMarkets` prefers `data/market-history/exports/allowlist-eod.ndjson.gz` when present (full local dump); otherwise committed `demo-eod.ndjson`. It **deletes** prior valuations for symbols in that file, then imports. Demo watchlist uses the curated 5 favorites when loading a full export.

### Incremental re-seed (keep catalog)

1. Ensure migrations are applied (`cd backend && npx prisma migrate deploy` if needed).
2. Optional Markets: catalog + universe already present.
3. `npm run db:seed`
4. Log in: `demo@finance.local` / `demo12345` (username: `demo`).

## What you get

| Surface | Sample content |
|---------|----------------|
| `/accounts` | Everyday Checking (BANK/PLN), Euro Travel (BANK/EUR), Brokerage Cash (BROKERAGE/PLN), Brokerage USD (BROKERAGE/USD), Crypto Spot (CRYPTO/USD), Everyday Credit Card (CREDIT_CARD/PLN, debt), IKE Brokerage (IKE/PLN) |
| `/categories` | Default roots by ledgerType plus a **demo-only** nest to depth 3 (e.g. Food → Groceries → Supermarket; Salary → Primary job → Base salary; Internal transfer → Investment → Brokerage cash). Empty users still get flat roots only. |
| `/tags` | Cross-cutting trip/project tags (Italy trip 2026, Home renovation, Kids birthday, …) on matching cash expenses — one tag groups spend across many categories |
| `/accounts/:id` | ~24 months of INCOME/EXPENSE rows (≥5 per month per account, including card purchases and light IKE fees/interest); categories + purpose tags on many expenses; read-only `TRANSFER IN/OUT` legs from seeded transfers (with TRANSFER categories). On Brokerage Cash / Brokerage USD / IKE: seeded BUY/SELL history (priced from demo EOD), open holdings, `ASSET_*` cash legs, and balance-history cash / holdings / equity series |
| `/transfers` | Same-/cross-currency showcase rows, plus monthly Checking → Credit Card payments (450 PLN) and Checking → IKE contributions (500 PLN) for each ledger month — each transfer tagged with a TRANSFER category |
| `/dashboard` | NBP-converted net-worth buckets + history chart (credit-card debt in liabilities; brokerage equity includes holdings MTM), period KPIs converted into the topbar reporting currency across all accounts (pick PLN/EUR/USD). Seed auto-loads ~24m EUR/USD mids (live NBP, or offline monthly fixture if NBP is unreachable) |
| `/statistics` | Period KPIs, cashflow chart, and category breakdown across the seeded history (transfer legs excluded). Donut rolls to **tree roots**; detail starts collapsed at roots — expand Food to see Groceries → Supermarket (rolled-up totals) |
| `/markets` | When catalog + universe are present: demo watchlist (AAPL, VOO, SPX, XTB, ETFBW20TR) with sparse EOD from committed `demo-eod.ndjson` (~1y, one close/month) — no Yahoo/TD on seed |

## Notes

- Implementation: [`backend/prisma/seed.ts`](../../backend/prisma/seed.ts) + [`seedDemoPortfolio.ts`](../../backend/src/domain/seedDemoPortfolio.ts) + [`seedDemoFxRates.ts`](../../backend/src/domain/seedDemoFxRates.ts) + [`seedDemoMarkets.ts`](../../backend/src/domain/seedDemoMarkets.ts) + [`seedDemoAssetTrades.ts`](../../backend/src/domain/seedDemoAssetTrades.ts).
- Ledger is **deterministic** (PRNG seed `demo-portfolio-v2`): same amounts on every run. Transfers (`buildDemoTransfers`) include showcase rows plus one card payment and one IKE contribution per month. Each account `cashBalance` is opening + signed ledger deltas including transfer legs (then adjusted by seeded `ASSET_*` trades).
- FX: `seedDemoFxRates` syncs NBP EUR/USD for the demo ledger window; if NBP fails, upserts monthly fixture mids so net worth does not error with “No NBP FX rate…”.
- Markets fixture is deterministic offline data; missing instruments are skipped with a console warning (cash portfolio still seeds).
- Asset trades run **after** markets: PLN symbols (XTB, ETFBW20TR) on Brokerage Cash / IKE; USD (AAPL, VOO) on Brokerage USD; SPX watchlist-only. Unit prices come from seeded valuations; log includes `trades.applied`.
- Password hash is reset to the known demo password on every run.
- Other users in the same database are not modified.
- Hub: [docs/README.md](../README.md).
