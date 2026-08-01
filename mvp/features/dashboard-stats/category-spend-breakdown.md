---
id: FR-016
status: done
domain: dashboard-stats
title: Category spend breakdown
---

# Category spend breakdown

## Summary

Expense/income by category for a selected calendar month (UTC), grouped by currency.

## User value

See where money went (and came from) by category without waiting for full budgets or FX rollups.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /statistics |

## Acceptance

- [x] `GET /api/statistics/category-breakdown?month=YYYY-MM` returns income/expense rows
- [x] Category breakdown section on `/statistics` with month picker

## Implementation notes

- Domain: `backend/src/domain/categoryBreakdown.ts`
- Routes: `backend/src/routes/statisticsRoutes.ts`
- UI: `frontend/src/pages/StatisticsPage.tsx`
- Docs: [docs/how-to/dashboard-and-statistics.md](../../../docs/how-to/dashboard-and-statistics.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- FX conversion to a single display currency
- Charts (Recharts reserved for later)
- Period cashflow summary / history (FR-003 / FR-004)
- Parent-category rollup
