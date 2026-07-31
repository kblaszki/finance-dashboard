---
diataxis: how-to
use_when: Manage accounts, holdings, lots, and asset trades day-to-day
audience: both
related_docs:
  - docs/reference/domain.md
  - docs/how-to/brokerage-and-fx.md
  - docs/how-to/import-csv.md
related_code:
  - backend/src/routes/accountsRoutes.ts
  - backend/src/routes/holdingsRoutes.ts
  - backend/src/routes/assetTradesRoutes.ts
---

# Accounts and holdings

Hub: [docs/README.md](../README.md).

Primary portfolio ops: create accounts, enter trades, inspect lots and charts. Account-type capabilities: [domain.md — Account workflow](../reference/domain.md#account-workflow).

## Accounts

1. List/create: `/accounts` — `GET/POST /api/accounts`.
2. Detail: `/accounts/:id` — stats, valuations chart, type-specific widgets.
3. Update: `PUT /api/accounts/:id` (name, description, `metalGrams`, `taxWrapperType`, `rentalTaxMethod` as allowed).
4. Revalue (MANUAL / REAL_ESTATE / OTHER): `POST /api/accounts/:id/revalue` — `{ value, valuationDate? }`.
5. Delete: `DELETE /api/accounts/:id`.

## Holdings and lots

1. Open positions: `GET /api/accounts/:accountId/holdings` or UI tables on account detail.
2. Find-or-create holding: `POST /api/accounts/:accountId/holdings` with `instrumentId`.
3. Holding detail: `/accounts/:id/assets/:instrumentId` — KPIs, lot table, valuation chart.
4. Lots: `GET/POST /api/holdings/:holdingId/lots` (optional `commission`, `settlementDate`); `DELETE /api/holding-lots/:id`.
5. Split shortcut: `POST /api/holdings/:holdingId/split` — prefer [corporate-actions.md](corporate-actions.md) when auditing.

## Asset trades (global list)

1. UI: `/transactions` (`AssetTradesTable`).
2. `GET/POST /api/asset-trades` — creates lots; BUY may trigger market sync when `MARKET_DATA_API_KEY` is set.

## Related recipes

- CSV import: [import-csv.md](import-csv.md)
- FX / brokerage pointers: [brokerage-and-fx.md](brokerage-and-fx.md)
- Cash between accounts: [internal-transfers.md](internal-transfers.md)
- Securities between brokerages: [position-transfers.md](position-transfers.md)
