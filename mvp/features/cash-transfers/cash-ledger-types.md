---
id: MVP-011
status: planned
domain: cash-transfers
title: Cash ledger transaction types
---

# Cash ledger transaction types

## Summary

Single-account cash ledger for **INCOME** and **EXPENSE** only. Positive `amount` + type drives sign; create updates `Account.cashBalance` atomically. No `balanceAfter` column — account balance is the source of truth.

## User value

Users can record cash in/out on an account and see the balance change, without transfers, categories, or historical balance snapshots yet.

## Surfaces

| Kind | Location |
|------|----------|
| UI | Account cash ledger (create + list on `/accounts/:id` or equivalent account detail) |
| API | `POST/GET` cash transactions scoped to an owned account |
| Code | Prisma cash-transaction model; domain balance update; routes under `/api/...` |

## Acceptance

- [ ] Create INCOME or EXPENSE on an owned account with positive `amount`, optional `date` / `description`
- [ ] Type drives signed effect: INCOME increases `cashBalance`, EXPENSE decreases it
- [ ] Create runs in one DB transaction: insert ledger row + update `Account.cashBalance`
- [ ] List transactions for an owned account (newest first or by date)
- [ ] Cross-user access returns 404
- [ ] No `balanceAfter` field on the ledger row
- [ ] v1: no edit of amount/type; delete either forbidden or implemented as reverse (must keep `cashBalance` correct)

## Design rules

- **Amount:** always store a positive number; never signed storage for v1
- **Opening balance:** remains a seed on `Account` (`openingBalance` / initial `cashBalance`); not a ledger row
- **Running balance in UI:** compute when listing if needed (optional); do not persist per-row snapshots
- **Account types:** any existing allow-listed account may have a cash ledger in this slice

## Implementation notes

- Docs (when shipping): [docs/reference/domain.md](../../../docs/reference/domain.md), [docs/reference/api.md](../../../docs/reference/api.md), [docs/reference/frontend.md](../../../docs/reference/frontend.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)
- Money rules live in a backend domain module (not only in the route handler)

## Out of scope / follow-ups

- `TRANSFER_*` / paired transfers / FX — [FR-011](internal-cash-transfers.md)
- `DIVIDEND`, `INTEREST` as distinct types (can map to INCOME later if needed)
- Categories and splits — [FR-018](transaction-categories-splits.md)
- Persisted `balanceAfter` / append-only audit snapshots
- Editing historical amounts without a clear reverse/rebuild policy
- Holdings / asset trades — holdings-trades domain
