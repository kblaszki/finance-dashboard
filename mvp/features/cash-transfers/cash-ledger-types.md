---
id: MVP-011
status: done
domain: cash-transfers
title: Cash ledger transaction types
---

# Cash ledger transaction types

## Summary

Single-account cash ledger for **INCOME** and **EXPENSE** only. Positive `amount` + type drives sign; create updates `Account.cashBalance` atomically. No `balanceAfter` column — account balance is the source of truth. Delete reverses the balance effect.

## User value

Users can record cash in/out on an account and see the balance change, without transfers, categories, or historical balance snapshots yet.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/accounts/:id` (`AccountDetailPage`) |
| API | `GET/POST /api/accounts/:accountId/transactions`, `DELETE .../transactions/:id` |
| Code | `CashTransaction` model; `domain/cashLedger.ts`; `cashTransactionsRoutes.ts` |

## Acceptance

- [x] Create INCOME or EXPENSE on an owned account with positive `amount`, optional `occurredAt` / `description`
- [x] Type drives signed effect: INCOME increases `cashBalance`, EXPENSE decreases it
- [x] Create runs in one DB transaction: insert ledger row + update `Account.cashBalance`
- [x] List transactions for an owned account (`occurredAt` desc)
- [x] Cross-user access returns 404
- [x] No `balanceAfter` field on the ledger row
- [x] Delete reverses `cashBalance` and removes the row (no edit of amount/type)

## Design rules

- **Amount:** always store a positive number; never signed storage for v1
- **Opening balance:** remains a seed on `Account` (`openingBalance` / initial `cashBalance`); not a ledger row
- **Running balance in UI:** not persisted per row
- **Account types:** any existing allow-listed account may have a cash ledger in this slice

## Implementation notes

- Docs: [docs/reference/domain.md](../../../docs/reference/domain.md), [docs/reference/api.md](../../../docs/reference/api.md), [docs/reference/frontend.md](../../../docs/reference/frontend.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)
- Money rules: `backend/src/domain/cashLedger.ts`

## Out of scope / follow-ups

- `TRANSFER_*` / paired transfers / FX — [FR-011](internal-cash-transfers.md)
- `DIVIDEND`, `INTEREST` as distinct types (can map to INCOME later if needed)
- Categories and splits — [FR-018](transaction-categories-splits.md)
- Persisted `balanceAfter` / append-only audit snapshots
- Editing historical amounts without a clear reverse/rebuild policy
- Holdings / asset trades — holdings-trades domain
