---
id: MVP-026
status: done
domain: accounts
title: Polish retail treasury bond positions
---

# Polish retail treasury bond positions

## Summary

Track Polish retail Skarb Państwa bond lots on `TREASURY_BONDS` accounts with manual rates, gross equity in net worth, and a Belka/fee liquidation estimate on the account detail card.

## User value

See bond book value in wealth totals without abusing equity `Holding` / Markets, and estimate early-exit proceeds after fee and Belka.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/accounts/:id` — `TreasuryBondsPanel` |
| API | `GET/POST/PATCH/DELETE /api/accounts/:accountId/bond-positions` |
| Code | `backend/src/domain/bondValuation.ts`, `bondPositions.ts`, `bondPositionsRoutes.ts`; `frontend/src/api/bondPositionsApi.ts` |

## Acceptance

- [x] Create/list/update/delete bond lots only on owned `TREASURY_BONDS` + PLN accounts
- [x] Valuation: nominal, accrued (actual/365), gross, early-exit fee, Belka 19% estimate, liquidation net
- [x] Account `holdingsValue` / net worth include bond **gross** (bucket remains `other`)
- [x] Account detail panel shows table + add form; notes that NW uses gross

## Implementation notes

- How-to: [docs/how-to/treasury-bonds.md](../../../docs/how-to/treasury-bonds.md)
- Domain: [docs/reference/domain.md](../../../docs/reference/domain.md) (`BondPosition`)
- Related planned: FR-033 coupon schedules / record-income; FR-027 full Belka tax report; IKE/IKZE bond sleeve

## Out of scope / follow-ups

- GUS/WIBOR auto rate updates, roll wizard, Catalyst, PDF
- IncomeEvent / coupon calendar
- Separate net-worth `bonds` bucket
- IKE/IKZE obligacje sleeve
