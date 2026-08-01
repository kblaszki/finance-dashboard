---
id: FR-003
status: done
domain: dashboard-stats
title: Statistics period cashflow summary
---

# Statistics period cashflow summary

## Summary

Period income/expense/net KPIs (default current month), filtered by one account currency.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /statistics |

## Acceptance

- [x] Period filter drives stats KPIs
- [x] `GET /api/statistics/period-summary?month=YYYY-MM&currency=XXX` powers KPIs

## Implementation notes

- Domain: `backend/src/domain/cashflowStats.ts`
- Routes: `backend/src/routes/statisticsRoutes.ts`
- Docs: [docs/how-to/dashboard-and-statistics.md](../../../docs/how-to/dashboard-and-statistics.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- FX conversion; filtering category breakdown by currency
- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
