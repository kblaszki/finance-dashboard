---
id: MVP-014
status: done
domain: cash-transfers
title: Cash ledger CSV import
---

# Cash ledger CSV import

## Summary

Per-account import of cash ledger rows in the same CSV format as export. Always creates new transactions (`id` / `createdAt` ignored). INCOME/EXPENSE all-or-nothing validation; `TRANSFER_*` rows are skipped and reported.

## User value

Restore or bulk-load ledger rows from a spreadsheet or prior export without retyping.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/accounts/:id` — Upload CSV → `ImportCategoryMappingPanel` when categories are present |
| API | `POST …/import/preview`, `POST …/import` with `categoryMappings` |
| Code | `cashLedgerCsvImport.ts`; `cashLedgerImportCategories.ts`; `cashTransactionsRoutes.ts`; `transactionsApi.previewTransactionsImport` / `importTransactionsCsv` |

## Acceptance

- [x] Owner imports CSV matching export header; new rows created; balance updated
- [x] `id` / `createdAt` ignored (re-import duplicates)
- [x] Currency required and must match account
- [x] Each used `(categoryPath, ledgerType)` requires explicit `map` / `create` / `none`
- [x] Preview suggests exact path matches; UI blocks Import until every category is decided
- [x] Legacy `categoryId,categoryName` header → `400` (re-export required)
- [x] Invalid INCOME/EXPENSE row → `400` with `details`; nothing written
- [x] `TRANSFER_*` rows skipped (`skipped` / `skippedTransfers`); UI mentions Transfers page
- [x] Header-only / no categories → `{ created, createdCategories: 0, skipped: 0 }`
- [x] UI Upload CSV next to Download CSV

## Implementation notes

- Docs: [docs/reference/api.md](../../../docs/reference/api.md), [docs/reference/frontend.md](../../../docs/reference/frontend.md)
- Not FR-019 (bank/broker import)

## Out of scope / follow-ups

- Bank/broker CSV import — [FR-019](../import/csv-import-bank-broker.md)
- Fuzzy matching / saved mapping presets
- Idempotent / upsert by id
