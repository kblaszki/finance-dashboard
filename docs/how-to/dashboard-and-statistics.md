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
  - backend/src/domain/statsPeriod.ts
  - backend/src/domain/tagBreakdown.ts
  - backend/src/domain/netWorth.ts
  - backend/src/domain/netWorthHistory.ts
  - backend/src/routes/statisticsRoutes.ts
  - frontend/src/pages/DashboardPage.tsx
  - frontend/src/components/dashboard/
  - frontend/src/pages/StatisticsPage.tsx
  - frontend/src/state/currency.tsx
---

# Dashboard and statistics

Hub: [docs/README.md](../README.md).

This page covers shipped dashboard KPIs (`/dashboard`) and statistics (`/statistics`). Currency is chosen once in the shell topbar (persisted in `localStorage`).

## Dashboard: executive overview (FR-002 / FR-005 / FR-038)

1. Open **Dashboard** (or go to `/dashboard`). `/home` redirects here.
2. Confirm the **reporting currency** in the top bar (`PLN` / `EUR` / `USD` from your accounts). Incomplete workspaces still show the **Setup checklist** first.
3. Review **Wealth hero**: total net worth for **all** owned accounts converted into the topbar currency via stored NBP mids (valuation / rate dates shown), cash / invested / debt chips, and a **net-worth history** area chart. Range chips `6M` / `1Y` / `2Y` slice the fetched 24-month series client-side.
4. Review **period KPI strip** for the current UTC month (scoped to the selected currency only — labeled with that currency): income, expense, savings ratio (`net / income`), and monthly net, each with % vs the previous month when available.
5. Review the **executive grid**:
   - **Portfolio allocation** — donut + legend by account-type bucket (after FX); link to Accounts.
   - **Goals in motion** — empty placeholder until a goals feature exists.
   - **Ideas** — heuristic educational tips from live surplus / savings ratio / liabilities (not advice).
   - **Recent activity** — latest internal transfers (`GET /api/transfers?limit=8`).
6. APIs:
   - `GET /api/statistics/net-worth?currency=XXX`
   - `GET /api/statistics/net-worth-history?month=YYYY-MM&currency=XXX&months=24`
   - `GET /api/statistics/period-summary?month=YYYY-MM&currency=XXX` (current + previous month)
   - `GET /api/transfers?limit=8`
   - `GET /api/accounts` (shared via `CurrencyProvider`)
   - `GET /api/categories` (setup checklist only)

Net worth uses persisted NBP rates only (no live NBP during the request). Mapping after conversion: `BANK→cash`, `BROKERAGE|IKE|IKZE→stock`, `CRYPTO→crypto`, `PRECIOUS_METAL→metal`, `REAL_ESTATE→real_estate`, `OTHER|MANUAL|TREASURY_BONDS→other`. `CREDIT_CARD` debt adds to `liabilities`; overpayment goes to `cash`. Mortgage-style liabilities (FR-029) are separate. Holdings valuations are not included. Ensure FX history is synced before relying on long charts (`cd backend && npm run build && npm run fx:sync -- --days 760`). Rolling 12-month cashflow averages remain on **Statistics**.

## Period KPIs and cashflow chart (FR-003 / FR-004)

1. Open **Statistics** in the AppShell (or go to `/statistics`).
2. Choose **Month**, **Quarter**, or **Year**, then pick the anchor (month input, quarter + year, or year). Currency comes from the top bar. Optionally set history range (6 / 12 / 24 months).
3. Review **Period summary**: income, expense, net, and **transfers** (sum of outgoing transfer `amountFrom` in that currency). Each KPI shows **% vs previous** period (prior month / quarter / year); when the previous total is zero the subtitle is `— vs prev`. Transfers do **not** change income/expense/net.
4. Review **Cashflow history**: monthly income/expense bars, net line, and savings-rate line (`net / income` per month) on a second axis. The series ends at the last month of the selected period.
5. APIs:
   - `GET /api/statistics/period-summary?month=YYYY-MM&currency=XXX&period=month|quarter|year`
   - `GET /api/statistics/cashflow-history?month=YYYY-MM&currency=XXX&months=12&period=…`

Bounds are UTC. `period` defaults to `month`. Quarter/year are calendar bounds containing the anchor month. History series is oldest → newest and zero-fills empty months.

## Category and tag breakdown (FR-016+)

1. On `/statistics`, open the **Categories** or **Tags** tab under the charts.
2. **Categories:** switch Income / Expense / Transfers. Donuts roll up to each **category tree root**; the detail table starts at **roots** (rolled-up totals) and expands with ▸ to show nested children (Food ≥ Groceries ≥ Supermarket). Transfer rows come from `CashTransfer` categories (not ledger `TRANSFER_*` legs).
3. **Tags:** switch Income / Expense. Full amount is counted under each attached tag (a multi-tag transaction appears in each tag). **Untagged** is listed separately. Tags apply only to cash income/expense.
4. Totals use the category/tag name currently stored (renames affect past periods).
5. APIs:
   - `GET /api/statistics/category-breakdown?month=YYYY-MM&period=…` (+ `GET /api/categories` for the rollup join)
   - `GET /api/statistics/tag-breakdown?month=YYYY-MM&currency=XXX&period=…`

**Tip:** Run `cd backend && npm run db:seed` for the demo user (deterministic ~24 months of ledger history). Open `/dashboard` (PLN in the top bar) for the executive overview, and `/statistics` for rolling averages, period KPIs, and breakdown charts across seeded months.
