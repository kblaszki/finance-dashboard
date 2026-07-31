---
diataxis: how-to
use_when: Create or reverse a cross-account internal cash transfer
audience: both
related_docs:
  - docs/reference/api.md
  - docs/reference/frontend.md
related_code:
  - backend/src/internalTransfers.ts
  - backend/src/routes/internalTransfersRoutes.ts
  - frontend/src/api/internalTransfersApi.ts
---

# Internal transfers

Hub: [docs/README.md](../README.md).

Move cash between two of the user’s accounts as a paired transfer (one debit + one credit), including optional cross-currency FX.

## UI

1. Open `/transfers` (`TransfersPage` / `InternalTransfersTable`).
2. Optional filter: `?accountId=`.
3. Create a transfer with from/to accounts, amounts, date, optional note / commission / exchange rate.
4. Delete undoes both legs by `groupId`.

## API

| Step | Call |
|------|------|
| List | `GET /api/internal-transfers` — optional `from`, `to`, `accountId` |
| FX hint | `GET /api/internal-transfers/fx-suggestion?fromCurrency=&toCurrency=&fromAmount=` — uses NBP via `fx.ts` |
| Create | `POST /api/internal-transfers` — `{ fromAccountId, toAccountId, fromAmount, toAmount, date, exchangeRate?, commission?, note? }` |
| Delete | `DELETE /api/internal-transfers/:groupId` |

Create runs atomically in domain (`createInternalTransfer` in `internalTransfers.ts`). Both accounts must belong to the authenticated user. Same-currency transfers omit exchange rate; cross-currency should set `fromAmount`, `toAmount`, and usually `exchangeRate` (UI can prefill from fx-suggestion).

## Agent notes

- Do not reimplement FX in the UI — suggestion endpoint and `fx.ts` own rates.
- Distinct from **position** transfers — see [position-transfers.md](position-transfers.md) (`/api/position-transfers`).
- Catalog: [api.md](../reference/api.md) Internal transfers rows; client: `internalTransfersApi.ts`.
