---
diataxis: how-to
use_when: Move cash between owned accounts
audience: both
related_docs:
  - docs/reference/api.md
  - docs/reference/frontend.md
  - docs/reference/domain.md
related_code:
  - backend/src/domain/cashTransfers.ts
  - backend/src/routes/transfersRoutes.ts
  - frontend/src/pages/TransfersPage.tsx
  - frontend/src/api/transfersApi.ts
---

# Internal cash transfers

Hub: [docs/README.md](../README.md).

Move cash between two of your accounts. The transfer header (`CashTransfer`) is the source of truth; each side shows a read-only ledger leg (`TRANSFER_OUT` / `TRANSFER_IN`).

## Create or edit a transfer

1. Open `/transfers` (AppShell nav).
2. Use the top create row: date, from account, to account, amount from, optional amount to (required when currencies differ), description. Enter or **Add** submits; focus returns to the date field.
3. Same currency: leave amount to blank (it mirrors amount from). Different currencies: enter both amounts; the UI shows a computed FX rate (`amountTo / amountFrom`) — no NBP lookup.
4. Edit an existing row with double-click on Date / From / To / Amount from / Amount to (cross-currency only) / Description. Enter saves; Escape or blur cancels.
5. Delete from Actions (confirm). Both ledger legs and balances reverse.

## Ledger legs

1. Open either account at `/accounts/:id`.
2. Transfer legs show badges **TRANSFER OUT** / **TRANSFER IN**, are not double-click editable, and link to `/transfers` instead of Delete.
3. PATCH/DELETE on those rows via the cash-transaction API returns `400` — change the transfer instead.

## Account delete

Delete an account that still appears in any transfer → `409` (“delete transfers first”). Remove or re-point transfers first so the other account’s balance stays consistent.

## Demo data

`npm run db:seed` loads a few sample transfers (same-currency and cross-currency) for `demo@finance.local`. See [demo-seed.md](../tutorials/demo-seed.md).

## API

`GET|POST /api/transfers`, `PATCH|DELETE /api/transfers/:id`. See [api.md](../reference/api.md).
