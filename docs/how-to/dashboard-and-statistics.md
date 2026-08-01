---
diataxis: how-to
use_when: View period cashflow KPIs, history chart, or category breakdown
audience: both
related_docs:
  - docs/reference/api.md
  - docs/reference/frontend.md
related_code:
  - backend/src/domain/categoryBreakdown.ts
  - backend/src/domain/cashflowStats.ts
  - backend/src/routes/statisticsRoutes.ts
  - frontend/src/pages/StatisticsPage.tsx
---

# Dashboard and statistics

Hub: [docs/README.md](../README.md).

This page covers shipped statistics on `/statistics`: period KPIs (FR-003), cashflow history chart (FR-004), and category breakdown (FR-016).

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

1. On the same page, review **Income** and **Expense** lists for the selected month (all currencies; not filtered by the currency control).
2. Totals by tagged category (or Uncategorized), grouped separately per account currency. There is no FX conversion.
3. Totals use the category name currently stored (renames affect past months). Parent categories are not rolled up — only the tag on each transaction.
4. API: `GET /api/statistics/category-breakdown?month=YYYY-MM`.

**Tip:** Run `cd backend && npm run db:seed` for the demo user, then open `/statistics` for the current UTC month. Pick PLN or EUR to see KPIs/chart; switch the month picker to the prior month for Everyday Checking history.
