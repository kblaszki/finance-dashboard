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

- Cash balances by account-type buckets after NBP FX into the topbar reporting currency (`PLN`|`EUR`|`USD`). Holdings valuations still excluded.
- Domain: `backend/src/domain/netWorth.ts` (+ history in `netWorthHistory.ts`)
- Routes: `backend/src/routes/statisticsRoutes.ts`
- Docs: [docs/how-to/dashboard-and-statistics.md](../../../docs/how-to/dashboard-and-statistics.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (FR-002 + **FR-038** for FX rollup/history)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- Holdings valuations; real liabilities (FR-029)
- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
