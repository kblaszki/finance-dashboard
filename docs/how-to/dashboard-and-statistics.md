---
diataxis: how-to
use_when: View home net worth / rolling cashflow or statistics period KPIs and charts
audience: both
related_docs:
  - docs/reference/api.md
  - docs/reference/frontend.md
related_code:
  - backend/src/domain/categoryBreakdown.ts
  - backend/src/domain/cashflowStats.ts
  - backend/src/domain/netWorth.ts
  - backend/src/routes/statisticsRoutes.ts
  - frontend/src/pages/HomePage.tsx
  - frontend/src/pages/StatisticsPage.tsx
---

# Dashboard and statistics

Hub: [docs/README.md](../README.md).

This page covers shipped home dashboard KPIs (`/home`) and statistics (`/statistics`).

## Home: net worth and rolling cashflow (FR-002 / FR-005)

1. Open **Home** (or go to `/home`).
2. Pick a **currency** from your accounts.
3. Review **Net worth**: total and buckets (`cash` / `stock` / `crypto` / `metal` / `real_estate` / `other`) from account `cashBalance` by `accountType`. Liabilities are always `0` until a liability model ships. Holdings valuations are not included.
4. Review **Rolling 12-month cashflow**: average monthly income, expense, and net over the last 12 **complete** UTC months (excludes the current calendar month).
5. APIs:
   - `GET /api/statistics/net-worth?currency=XXX`
   - `GET /api/statistics/cashflow-rolling-12m?currency=XXX`

No FX conversion. Mapping: `BANK→cash`, `BROKERAGE→stock`, `CRYPTO→crypto`, `PRECIOUS_METAL→metal`, `REAL_ESTATE→real_estate`, `OTHER|MANUAL→other`.

## Period KPIs and cashflow chart (FR-003 / FR-004)

1. Open **Statistics** in the AppShell (or go to `/statistics`).
2. Pick a calendar month (`YYYY-MM`), a **currency** from your accounts, and a history range (6 / 12 / 24 months).
3. Review **Period summary**: income, expense, and net for that UTC month and currency only (no FX).
4. Review **Cashflow history**: monthly income/expense bars and net line ending at the selected month.
5. APIs:
   - `GET /api/statistics/period-summary?month=YYYY-MM&currency=XXX`
   - `GET /api/statistics/cashflow-history?month=YYYY-MM&currency=XXX&months=12` (`months` optional; default 12)

Bounds are UTC (`[month start, next month start)` on `occurredAt`). History series is oldest → newest and zero-fills empty months.

## Category breakdown (FR-016)

1. On `/statistics`, review **Income** and **Expense** lists for the selected month (all currencies; not filtered by the currency control).
2. Totals by tagged category (or Uncategorized), grouped separately per account currency. There is no FX conversion.
3. Totals use the category name currently stored (renames affect past months). Parent categories are not rolled up — only the tag on each transaction.
4. API: `GET /api/statistics/category-breakdown?month=YYYY-MM`.

**Tip:** Run `cd backend && npm run db:seed` for the demo user, then open `/home` (pick PLN) for net worth + rolling averages, and `/statistics` for period KPIs/chart. Switch the month picker to the prior month for Everyday Checking history.
