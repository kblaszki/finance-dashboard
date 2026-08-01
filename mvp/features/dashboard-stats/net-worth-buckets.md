---
id: FR-002
status: done
domain: dashboard-stats
title: Net worth with five asset buckets
---

# Net worth with five asset buckets

## Summary

Cash balances by account-type buckets (cash/stock/crypto/metal/real_estate/other) minus liabilities (always 0 until liability model).

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /dashboard NetWorthDonut |

## Acceptance

- [x] `GET /api/statistics/net-worth` returns `byBucket` and `liabilities`

## Implementation notes

- Thin MVP: sums `Account.cashBalance` only (no holdings valuations, no FX).
- Domain: `backend/src/domain/netWorth.ts`
- Routes: `backend/src/routes/statisticsRoutes.ts`
- Docs: [docs/how-to/dashboard-and-statistics.md](../../../docs/how-to/dashboard-and-statistics.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- Holdings valuations; FR-038 PLN FX rollup; real liabilities (FR-029)
- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
