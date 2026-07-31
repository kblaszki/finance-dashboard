---
diataxis: how-to
use_when: Record a stock split or other corporate action
audience: both
related_docs:
  - docs/reference/domain.md
  - docs/reference/api.md
related_code:
  - backend/src/corporateActions.ts
  - backend/src/stockSplit.ts
  - backend/src/routes/corporateActionsRoutes.ts
---

# Record corporate actions

Hub: [docs/README.md](../README.md).

## Mutating vs audit-only

| `actionType` | Effect |
|--------------|--------|
| `stock_split` / `reverse_split` | Scales open lot quantities and `quantityAfter` by ratio; divides `pricePerUnit`; recomputes valuations from `actionDate` |
| `merger` / `spinoff` | Creates `CorporateAction` audit row only — **no** lot changes |

Also: `POST /api/holdings/:holdingId/split` applies a split without a corporate-action audit row (legacy/direct path).

## Steps

1. Ensure the holding exists on a brokerage (or holdings-capable) account.
2. UI: `/tax/settings` — corporate actions form — or API below.
3. Create: `POST /api/corporate-actions` with `{ accountId, instrumentId, actionType, actionDate, ratio?, holdingId?, notes? }`.
4. List: `GET /api/corporate-actions` — optional `accountId`, `from`, `to`.
5. For a direct split only: `POST /api/holdings/:holdingId/split` — `{ ratio, effectiveDate }`.

Domain detail: [domain.md — Corporate actions](../reference/domain.md#corporate-actions).

| Area | Path |
|------|------|
| Domain | `corporateActions.ts`, `stockSplit.ts` |
| HTTP | `corporateActionsRoutes.ts`, holdings split on `holdingsRoutes.ts` |
| Client / UI | `corporateActionsApi.ts`, Tax settings page |
