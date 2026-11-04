---
diataxis: how-to
use_when: Recording Polish retail treasury bond lots on TREASURY_BONDS accounts or reading bond valuation / equity
audience: both
related_docs:
  - docs/reference/api.md
  - docs/reference/domain.md
  - docs/explanation/holdings-market-architecture.md
  - docs/how-to/brokerage-asset-trades.md
related_code:
  - backend/src/domain/bondValuation.ts
  - backend/src/domain/bondPositions.ts
  - backend/src/routes/bondPositionsRoutes.ts
  - frontend/src/components/account/TreasuryBondsPanel.tsx
  - frontend/src/api/bondPositionsApi.ts
---

# Treasury bonds (Polish retail SP)

## Prerequisites

- Account type `TREASURY_BONDS` with currency **PLN**
- Manual series data (no GUS/WIBOR auto rates in v1)
- Positions are **not** equity `Holding` / Markets catalog rows

## UI

1. Open `/accounts/:id` for a `TREASURY_BONDS` account.
2. Use **Treasury bonds** — table of series with nominal, gross, early-exit fee, Belka estimate, liquidation net; **Add position** form.
3. Account equity and net worth use **gross** (nominal + accrued). Liquidation net is display-only on the card.
4. Record coupon cash on the cash ledger or via [Cashflow](/cashflow) when you receive it (no coupon calendar in v1).

## API sketch

```http
POST /api/accounts/:accountId/bond-positions
Authorization: Bearer …
Content-Type: application/json

{
  "seriesCode": "COI0328",
  "quantity": 10,
  "unitPurchasePrice": 100,
  "purchasedAt": "2025-01-01T12:00:00.000Z",
  "rateKind": "FIXED",
  "currentAnnualRatePct": 6.5,
  "couponFrequency": "ANNUAL",
  "periodStart": "2025-01-01T12:00:00.000Z",
  "maturityDate": "2028-03-01T12:00:00.000Z"
}
```

List: `GET …/bond-positions` → `{ positions, totals }`. Update/delete: `PATCH` / `DELETE …/bond-positions/:id`.

## Valuation (v1)

| Field | Rule |
|-------|------|
| Nominal | `quantity × unitNominal` (default unit 100) |
| Accrued | Simple actual/365 from `periodStart` to as-of, capped at maturity |
| Gross | Nominal + accrued → feeds `holdingsValue` / net worth |
| Early-exit fee | `quantity × earlyExitFeePerUnit` (default 1 PLN) |
| Belka estimate | `19% × max(0, gross − fee − costBasis)` |
| Liquidation net | Gross − fee − Belka |

## Out of scope

IKE/IKZE bond sleeve, GUS auto rates, roll wizard, Catalyst, PDF, IncomeEvent / FR-033 record-income, separate net-worth `bonds` bucket.
