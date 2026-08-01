---
diataxis: how-to
use_when: View category income/expense breakdown for a month
audience: both
related_docs:
  - docs/reference/api.md
  - docs/reference/frontend.md
related_code:
  - backend/src/domain/categoryBreakdown.ts
  - backend/src/routes/statisticsRoutes.ts
  - frontend/src/pages/StatisticsPage.tsx
---

# Dashboard and statistics

Hub: [docs/README.md](../README.md).

This page covers the shipped category breakdown on `/statistics`. Period cashflow KPIs and charts (FR-003 / FR-004) are still backlog.

## Category breakdown (FR-016)

1. Open **Statistics** in the AppShell (or go to `/statistics`).
2. Pick a calendar month (`YYYY-MM`). Bounds are **UTC** (`[month start, next month start)` on `occurredAt`).
3. Review **Income** and **Expense** lists: totals by tagged category (or Uncategorized), grouped separately per account currency. There is no FX conversion.
4. Totals use the category name currently stored (renames affect past months). Parent categories are not rolled up — only the tag on each transaction.
5. API: `GET /api/statistics/category-breakdown?month=YYYY-MM`.

**Tip:** Run `cd backend && npm run db:seed` for the demo user, then open `/statistics` for the current UTC month (multi-currency Food/Transport rows). Switch the month picker to the prior month to see Everyday Checking history.
