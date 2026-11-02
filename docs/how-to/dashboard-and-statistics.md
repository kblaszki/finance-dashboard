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

This page covers shipped dashboard KPIs (`/dashboard`) and cashflow analysis (`/cashflow`; `/statistics` redirects). Currency is chosen once in the shell topbar (persisted in `localStorage`).

## Dashboard: balanced overview (FR-002 / FR-005 / FR-038)

1. Open **Dashboard** (or go to `/dashboard`). `/home` redirects here.
2. Confirm the **reporting currency** in the top bar (`PLN` / `EUR` / `USD` — available once you have any account, even if you only hold one of them). Incomplete workspaces still show the **Setup checklist** first.
3. Review **Wealth hero**: total net worth for **all** owned accounts (cash + holdings mark-to-market) converted into the topbar currency via stored NBP mids (valuation / rate dates shown), cash / invested / debt chips, change over the selected chart range, and a **net-worth history** area chart. Range chips `6M` / `1Y` / `2Y` slice the fetched 24-month series client-side.
4. Review **This month** KPIs (reporting currency): income, expense, savings ratio (`net / income`), and monthly net from **all** owned accounts, each with **absolute + %** vs the previous month when available. Use **Open cashflow** / **Record expense** for the next step.
5. Review the **grid**:
   - **Where money went** — top expense category horizontal bars for the current month (native-currency filter matching the topbar currency); link to Cashflow.
   - **What I own** — allocation donut + legend by account-type bucket (after FX); link to Accounts.
6. **Recent cash activity** — latest income/expense across accounts (`GET /api/statistics/recent-activity`), with an uncategorized attention note when needed.
7. **Ideas** (below) — heuristic educational tips; goals are not available yet.
8. APIs:
   - `GET /api/statistics/net-worth?currency=XXX`
   - `GET /api/statistics/net-worth-history?month=YYYY-MM&currency=XXX&months=24`
   - `GET /api/statistics/period-summary?month=YYYY-MM&currency=XXX` (current + previous month)
   - `GET /api/statistics/category-breakdown?month=YYYY-MM`
   - `GET /api/statistics/recent-activity?limit=8`
   - `GET /api/accounts` (shared via `CurrencyProvider`)
   - `GET /api/categories` (setup checklist + category rollup)

Net worth uses persisted NBP rates only (no live NBP during the request). Mapping after conversion: `BANK→cash`, `BROKERAGE|IKE|IKZE→stock`, `CRYPTO→crypto`, `PRECIOUS_METAL→metal`, `REAL_ESTATE→real_estate`, `OTHER|MANUAL|TREASURY_BONDS→other`. `CREDIT_CARD` debt adds to `liabilities`; overpayment goes to `cash`. Mortgage-style liabilities (FR-029) are separate. Demo seed loads FX history automatically (`seedDemoFxRates`); otherwise sync with `cd backend && npm run build && npm run fx:sync -- --days 760`. Rolling 12-month cashflow averages remain on **Statistics**.

## Period KPIs and cashflow chart (FR-003 / FR-004)

1. Open **Cashflow** in the AppShell (or go to `/cashflow`).
2. Choose **Month**, **Quarter**, or **Year**, then pick the anchor (month input, quarter + year, or year). Currency comes from the top bar. Optionally set history range (6 / 12 / 24 months).
3. Review **Period summary**: income, expense, net, and **savings ratio** — all owned `PLN`/`EUR`/`USD` accounts converted into the topbar reporting currency (NBP mid on each row’s date). Transfer volume is noted under the KPIs and does **not** change income/expense/net. Each money KPI shows **absolute + % vs previous** period when available.
4. Review **category/tag breakdown** next (native-currency filter — see the warning banner). Totals for other currencies are omitted until FX-converted breakdown ships.
5. Review **Cashflow history**: monthly income/expense bars, net line, and savings-rate line (`net / income` per month) on a second axis (same all-account FX model).
6. Review **Rolling 12-month averages** (avg income/expense/net over the last 12 complete UTC months, excluding the current month).
7. APIs:
   - `GET /api/statistics/period-summary?month=YYYY-MM&currency=XXX&period=month|quarter|year`
   - `GET /api/statistics/cashflow-rolling-12m?currency=XXX`
   - `GET /api/statistics/cashflow-history?month=YYYY-MM&currency=XXX&months=12&period=…`

Bounds are UTC. `period` defaults to `month`. Quarter/year are calendar bounds containing the anchor month. History series is oldest → newest and zero-fills empty months. Category/tag breakdowns remain unconverted (single-currency filter on tags). Ensure FX history is synced before relying on multi-currency cashflow (`npm run fx:sync`).

## Category and tag breakdown (FR-016+)

1. On `/cashflow`, open the **Categories** or **Tags** tab (shown above the history chart).
2. **Categories:** switch Income / Expense / Transfers. Horizontal bars roll up to each **category tree root**; the detail table starts at **roots** (rolled-up totals) and expands with ▸ to show nested children (Food ≥ Groceries ≥ Supermarket). Transfer rows come from `CashTransfer` categories (not ledger `TRANSFER_*` legs).
3. **Tags:** switch Income / Expense. Horizontal bars by tag; full amount is counted under each attached tag (a multi-tag transaction appears in each tag). **Untagged** is listed separately. Tags apply only to cash income/expense.
4. Totals use the category/tag name currently stored (renames affect past periods).
5. APIs:
   - `GET /api/statistics/category-breakdown?month=YYYY-MM&period=…` (+ `GET /api/categories` for the rollup join)
   - `GET /api/statistics/tag-breakdown?month=YYYY-MM&currency=XXX&period=…`

**Tip:** Run `cd backend && npm run db:seed` for the demo user (deterministic ~24 months of ledger history). Open `/dashboard` (PLN in the top bar) for the executive overview, and `/cashflow` for rolling averages, period KPIs, and breakdown charts across seeded months.
