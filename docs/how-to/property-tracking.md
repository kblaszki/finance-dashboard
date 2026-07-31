---
diataxis: how-to
use_when: Track real-estate cash flows, sales, or manual asset valuations
audience: both
related_docs:
  - docs/reference/domain.md
  - docs/how-to/tax-year-workflow.md
related_code:
  - backend/src/propertyCashFlows.ts
  - backend/src/propertySales.ts
  - backend/src/assetValuations.ts
---

# Property and asset valuations

Hub: [docs/README.md](../README.md).

For `REAL_ESTATE`, `MANUAL`, `OTHER`, and `PRECIOUS_METAL` accounts (see domain account matrix).

## Property cash flows

1. UI: account detail (`PropertyCashFlowsSection`) on `REAL_ESTATE`.
2. `GET/POST/PUT/DELETE /api/property-cash-flows` — `flowType`: `rent` \| `maintenance` \| `other`.
3. Feeds rental section of the tax report ([tax-year-workflow.md](tax-year-workflow.md)).

## Property sales

1. Same account UI (`PropertySalesSection`) or `GET/POST/DELETE /api/property-sales`.
2. Fields include proceeds, acquisition/improvements cost, `fiveYearExemption`.
3. Set `rentalTaxMethod` via `PUT /api/accounts/:id` (`scale` \| `lump_sum_8_5`).

## Asset valuations

1. UI: `AssetValuationsSection` on eligible account types.
2. `POST /api/asset-valuations` — `{ accountId?, instrumentId?, value, currency, date, source?, description? }`.
3. When `accountId` is set on an allowed type, updates `cashBalance` and recomputes snapshots (like revalue).
4. `DELETE` removes the row but does **not** revert balance.

| Area | Path |
|------|------|
| Domain | `propertyCashFlows.ts`, `propertySales.ts`, `assetValuations.ts` |
| UI | Account detail widgets |
