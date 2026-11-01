---
diataxis: how-to
use_when: Recording BUY/SELL on brokerage accounts, reading holdings MTM, or wiring trade APIs
audience: both
related_docs:
  - docs/reference/api.md
  - docs/reference/domain.md
  - docs/explanation/holdings-market-architecture.md
  - docs/how-to/markets-watchlist.md
related_code:
  - backend/src/domain/assetTrades.ts
  - backend/src/routes/assetTradesRoutes.ts
  - frontend/src/components/account/BrokerageHoldingsPanel.tsx
---

# Brokerage asset trades and holdings MTM

## Prerequisites

- Account type `BROKERAGE`, `IKE`, or `IKZE`
- Instrument in the catalog (allowlisted or catalog search); **instrument quote currency must match account currency** (v1)
- Enough cash for BUY; enough open quantity for SELL (FIFO)

## UI

1. Open `/accounts/:id` for a brokerage-like account.
2. Use **Holdings** — MTM table, **New trade** (search instrument → date → BUY/SELL → qty/price/commission), **Recent trades** (delete reverses when allowed). Trade date defaults to today; change it to backdate a fill.

## API sketch

```http
POST /api/accounts/:accountId/asset-trades
Authorization: Bearer …
Content-Type: application/json

{
  "instrumentId": 1,
  "side": "BUY",
  "quantity": 10,
  "unitPrice": 100,
  "commission": 5
}
```

- List: `GET …/holdings`, `GET …/asset-trades`
- Delete/reverse: `DELETE …/asset-trades/:id` (BUY with closed lots → `400`)

Cash legs appear on the ledger as `ASSET_BUY` / `ASSET_SELL` (read-only there). Period cashflow stats ignore them. Account **balance history** chart shows three end-of-month series: cash, holdings MTM, and equity (sum). Net worth includes cash + holdings MTM.

## Related

- [api.md](../reference/api.md) — route catalog
- [markets-watchlist.md](markets-watchlist.md) — instruments / Yahoo closes
