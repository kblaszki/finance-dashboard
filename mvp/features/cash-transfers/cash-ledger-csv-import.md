---
id: MVP-014
status: done
domain: cash-transfers
title: Cash ledger CSV import
---

# Cash ledger CSV import

## Summary

Per-account import of cash ledger rows in the same CSV format as export. Always creates new transactions (`id` / `createdAt` ignored). All-or-nothing validation.

## User value

Restore or bulk-load ledger rows from a spreadsheet or prior export without retyping.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/accounts/:id` — Upload CSV on `AccountDetailPage` |
| API | `POST /api/accounts/:accountId/transactions/import` |
| Code | `domain/cashLedgerCsvImport.ts`; `cashTransactionsRoutes.ts`; `transactionsApi.importTransactionsCsv` |

## Acceptance

- [x] Owner imports CSV matching export header; new rows created; balance updated
- [x] `id` / `createdAt` ignored (re-import duplicates)
- [x] Currency empty or must match account; category by owned id or unique name
- [x] Invalid row → `400` with `details`; nothing written
- [x] Header-only → `{ created: 0 }`
- [x] UI Upload CSV next to Download CSV

## Implementation notes

- Docs: [docs/reference/api.md](../../../docs/reference/api.md), [docs/reference/frontend.md](../../../docs/reference/frontend.md)
- Not FR-019 (bank/broker import)

## Out of scope / follow-ups

- Bank/broker CSV import — [FR-019](../import/csv-import-bank-broker.md)
- Idempotent / upsert by id
