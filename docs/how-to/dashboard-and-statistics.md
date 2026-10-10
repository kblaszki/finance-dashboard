---
diataxis: how-to
use_when: View dashboard net worth / rolling cashflow or statistics period KPIs and charts
audience: both
related_docs:
  - docs/reference/api.md
  - docs/reference/frontend.md
related_code:
  - backend/src/domain/categoryBreakdown.ts
  - backend/src/domain/cashflowStats.ts
  - backend/src/domain/netWorth.ts
  - backend/src/routes/statisticsRoutes.ts
  - frontend/src/pages/DashboardPage.tsx
  - frontend/src/pages/StatisticsPage.tsx
  - frontend/src/state/currency.tsx
---

# Dashboard and statistics

Hub: [docs/README.md](../README.md).

This page covers shipped dashboard KPIs (`/dashboard`) and statistics (`/statistics`). Currency is chosen once in the shell topbar (persisted in `localStorage`).

## Dashboard: net worth, rolling cashflow, account mix (FR-002 / FR-005)

1. Open **Dashboard** (or go to `/dashboard`). `/home` redirects here.
2. Confirm the **currency** in the top bar (from your accounts).
3. Review **KPI row**: net worth, avg income / expense / net over 12 months, plus savings rate (`avgNet / avgIncome`).
4. Review **charts**: net-worth donut by account-type bucket, and a 12-month cashflow mini chart.
5. Review **Account mix**: per-account rows (name, type badge, balance) for the selected currency.
6. APIs:
   - `GET /api/statistics/net-worth?currency=XXX`
   - `GET /api/statistics/cashflow-rolling-12m?currency=XXX`
   - `GET /api/statistics/cashflow-history?month=YYYY-MM&currency=XXX&months=12`
   - `GET /api/accounts` (shared via `CurrencyProvider`)

No FX conversion. Mapping: `BANK→cash`, `BROKERAGE→stock`, `CRYPTO→crypto`, `PRECIOUS_METAL→metal`, `REAL_ESTATE→real_estate`, `OTHER|MANUAL→other`. Liabilities are always `0` until a liability model ships. Holdings valuations are not included. Rolling averages use the last 12 **complete** UTC months (excludes the current calendar month).

## Period KPIs and cashflow chart (FR-003 / FR-004)

1. Open **Statistics** in the AppShell (or go to `/statistics`).
2. Pick a calendar month (`YYYY-MM`) and a history range (6 / 12 / 24 months). Currency comes from the top bar.
3. Review **Period summary**: income, expense, and net for that UTC month and currency only (no FX).
4. Review **Cashflow history**: monthly income/expense bars, net line, and savings-rate line (`net / income` per month) on a second axis.
5. APIs:
   - `GET /api/statistics/period-summary?month=YYYY-MM&currency=XXX`
   - `GET /api/statistics/cashflow-history?month=YYYY-MM&currency=XXX&months=12` (`months` optional; default 12)

Bounds are UTC (`[month start, next month start)` on `occurredAt`). History series is oldest → newest and zero-fills empty months.

## Category breakdown (FR-016)

1. On `/statistics`, review **Income** and **Expense** donuts for the selected month, filtered to the top-bar currency.
2. Totals are rolled up client-side to the **child of each ledger-type root** (Salary, Food, … via `fetchCategories` + `ledgerType`); Uncategorized stays separate. Detail tables still list leaf tags with `count`.
3. Totals use the category name currently stored (renames affect past months).
4. API: `GET /api/statistics/category-breakdown?month=YYYY-MM` (+ `GET /api/categories` for the rollup join).

**Tip:** Run `cd backend && npm run db:seed` for the demo user (deterministic ~24 months of ledger history). Open `/dashboard` (PLN in the top bar) for net worth + rolling averages, and `/statistics` for period KPIs/chart across seeded months.
