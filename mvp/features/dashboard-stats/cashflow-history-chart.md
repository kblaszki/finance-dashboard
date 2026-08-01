---
id: FR-004
status: done
domain: dashboard-stats
title: Cashflow history chart
---

# Cashflow history chart

## Summary

Monthly income/expense/net series chart for one selected currency.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /statistics |

## Acceptance

- [x] `GET /api/statistics/cashflow-history` powers chart (`months` 6\|12\|24, default 12)

## Implementation notes

- Domain: `backend/src/domain/cashflowStats.ts`
- Routes: `backend/src/routes/statisticsRoutes.ts`
- UI: Recharts on `/statistics`
- Docs: [docs/how-to/dashboard-and-statistics.md](../../../docs/how-to/dashboard-and-statistics.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- FX conversion; FR-005 rolling-12m separate endpoint
- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
