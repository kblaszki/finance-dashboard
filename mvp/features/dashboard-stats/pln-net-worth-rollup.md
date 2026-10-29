---
id: FR-038
status: done
domain: dashboard-stats
title: Dashboard reporting-currency net-worth rollup
---

# Dashboard reporting-currency net-worth rollup

## Summary

Consolidated cash net worth across all owned `PLN` / `EUR` / `USD` accounts, converted into the topbar **reporting currency** with stored NBP mids (PLN pivot), plus a 6/12/24-month history chart.

## User value

See one net-worth number and trend regardless of which account currencies you hold; switch reporting currency in the top bar without losing the rollup.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | `/dashboard` WealthHero |
| API | `GET /api/statistics/net-worth`, `GET /api/statistics/net-worth-history` |

## Acceptance

- [x] Topbar-selected currency is the reporting currency (not fixed PLN-only)
- [x] All owned PLN/EUR/USD accounts are included and converted via PLN pivot
- [x] HTTP uses only persisted `FxRateDaily` rows (no live NBP)
- [x] Missing required rates fail closed with an actionable error
- [x] History points use month-end rates (today for the current month); opening uses `openingCashAsOf ?? createdAt`
- [x] Account create/edit currency limited to PLN/EUR/USD
- [x] Holdings valuations remain out of scope

## Implementation notes

- Docs: [docs/how-to/dashboard-and-statistics.md](../../../docs/how-to/dashboard-and-statistics.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code: `backend/src/domain/netWorth.ts`, `netWorthHistory.ts`; `frontend/src/components/dashboard/WealthHero.tsx`

## Out of scope / follow-ups

- Holdings valuations; mortgage-style liabilities (FR-029)
