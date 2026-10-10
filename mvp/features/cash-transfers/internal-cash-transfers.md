---
id: FR-011
status: done
domain: cash-transfers
title: Internal cash transfers with FX suggestion
---

# Internal cash transfers with FX suggestion

## Summary

Paired debit/credit between accounts via `CashTransfer` + `TRANSFER_OUT` / `TRANSFER_IN` legs. Cross-currency uses a manual destination amount (`fxRate` in the payload); NBP suggestion is deferred.

## User value

Move cash between owned accounts without counting the move as income/expense.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /transfers |
| Ledger legs | /accounts/:id (read-only) |

## Acceptance

- [x] Create/list/update/delete transfer groups
- [x] Same-currency and cross-currency (manual `amountTo`)
- [x] Legs appear on both accounts; excluded from cashflow stats
- [x] Account delete blocked while transfers exist (`409`)

## Implementation notes

- Docs: docs/how-to/internal-transfers.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)
- Domain: `backend/src/domain/cashTransfers.ts`; API: `/api/transfers`; UI: `TransfersPage`

## Out of scope / follow-ups

- NBP FX suggestion, transfer fees, recurring transfers, CSV import of transfers, create-from-ledger-row
