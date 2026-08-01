---
id: FR-018
status: in_progress
domain: cash-transfers
title: Transaction categories and splits
---

# Transaction categories and splits

## Summary

Optional `categoryId` on cash ledger transactions. Multi-line splits not shipped yet.

## User value

Tag INCOME/EXPENSE rows with a user category for later budgets and spend breakdowns.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | `/accounts/:id` ledger (AccountDetailPage) |

## Acceptance

- [x] `POST /api/accounts/:accountId/transactions` accepts optional `categoryId` (same-user category)
- [x] List/create responses include `categoryId`
- [ ] Multi-line splits on cash transactions

## Implementation notes

- Extends `CashTransaction.categoryId` (`onDelete: SetNull`)
- Categories: [category-tree.md](../budgets-categories/category-tree.md) (FR-015)
- Docs: [docs/how-to/budgets-and-categories.md](../../../docs/how-to/budgets-and-categories.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- Multi-line splits (remaining work for this FR)
- Auto-categorization rules (FR-034)
