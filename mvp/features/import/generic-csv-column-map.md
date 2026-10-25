---
id: MVP-022
status: done
domain: import
title: Generic CSV column map on account
---

# Generic CSV column map on account

## Summary

On `/accounts/:id` Upload CSV, when the file is not a known ledger export, the user maps columns to date/amount (and optional description, type, category path), chooses amount-sign meaning when type is absent, then continues through the existing category-mapping and import commit flow.

## User value

Import bank or card statement CSVs without converting them to the ledger export format first. Credit-card sign conventions are supported via `amountSignMode`.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/accounts/:id` — `ImportColumnMappingPanel` then `ImportCategoryMappingPanel` |
| API | `POST …/transactions/import/columns/{preview,apply,commit}` |
| Code | `backend/src/domain/csvColumnMap.ts`, `cashTransactionsRoutes.ts` |

## Acceptance

- [x] Unknown ledger header opens column mapping (not a hard failure only)
- [x] Required fields: occurredAt, amount; optional description/type/categoryPath
- [x] `amountSignMode` when type unmapped (`negativeIsExpense` / `negativeIsIncome`)
- [x] Known ledger export still imports without the column step
- [x] No DB-stored mapping profiles

## Implementation notes

- Docs: [docs/how-to/import-csv-column-map.md](../../../docs/how-to/import-csv-column-map.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- FR-019 bank/broker `/import` + ImportBatch idempotency
- FR-047 / MVP-020 saved presets and `/import/presets`
- Transfer rows or broker holdings CSV
