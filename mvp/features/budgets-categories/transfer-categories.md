---
id: MVP-017
status: done
domain: budgets-categories
title: Transfer category group (TRANSFER ledgerType)
---

# Transfer category group

## Summary

Categories may use `ledgerType: TRANSFER`. Internal cash transfers optionally reference one such category; both `TRANSFER_OUT` and `TRANSFER_IN` legs share it.

## User value

Label money movements (e.g. savings top-up) without mixing them into income/expense trees or cashflow stats.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/categories` Transfers section; `/transfers` category column |
| API | `CashTransfer.categoryId`; transfers CSV `categoryPath` |
| Code | `categories.ts`, `cashTransfers.ts`, `transfersCsv.ts`, Categories/Transfers pages |

## Acceptance

- [x] Seed includes Internal transfer (`TRANSFER`)
- [x] Create/update transfer with TRANSFER category copies id to both legs
- [x] INCOME/EXPENSE categories rejected on transfers
- [x] Ledger shows category on transfer legs; stats still exclude `TRANSFER_*`
- [x] Categories + transfers CSV support TRANSFER / categoryPath

## Implementation notes

- Docs: [docs/reference/domain.md](../../../docs/reference/domain.md), [docs/how-to/internal-transfers.md](../../../docs/how-to/internal-transfers.md)

## Out of scope / follow-ups

- Separate from/to categories
- Transfer spend breakdowns in statistics
