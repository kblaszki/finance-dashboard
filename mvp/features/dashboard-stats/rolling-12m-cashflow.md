---
id: FR-005
status: done
domain: dashboard-stats
title: Rolling 12-month cashflow averages
---

# Rolling 12-month cashflow averages

## Summary

Avg monthly income/expense/net over last 12 complete months.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /dashboard rolling KPIs |

## Acceptance

- [x] `GET /api/statistics/cashflow-rolling-12m` powers rolling KPIs

## Implementation notes

- Domain: `backend/src/domain/cashflowStats.ts`
- Routes: `backend/src/routes/statisticsRoutes.ts`
- Docs: [docs/how-to/dashboard-and-statistics.md](../../../docs/how-to/dashboard-and-statistics.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
