---
id: MVP-024
status: done
domain: import
title: Cash ledger import dedup + ImportBatch
---

# Cash ledger import dedup + ImportBatch

## Summary

Cash ledger CSV import (fixed header and column-mapped) skips rows that already match an INCOME/EXPENSE transaction on the account (UTC day + type + amount + normalized description). Preview and commit return a detailed `skippedDuplicates` list. Each successful commit writes an `ImportBatch` audit row.

## User value

Safe re-upload of bank statements without creating duplicate ledger rows; clear feedback on what was skipped.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/accounts/:id` Upload CSV — duplicate table + success copy |
| API | `…/import/preview`, `…/import`, `…/import/columns/apply`, `…/import/columns/commit` |
| Code | `domain/cashImportDedup.ts`, `ImportBatch` model |

## Acceptance

- [x] Fingerprint vs existing account cash txs
- [x] Intra-file duplicates skipped after first
- [x] Preview/commit expose `duplicateCount` + `skippedDuplicates`
- [x] `ImportBatch` created on commit (`ledger_csv` / `columns_csv`)
- [x] Category mappings only for non-duplicate rows

## Implementation notes

- Docs: [docs/how-to/import-csv-column-map.md](../../../docs/how-to/import-csv-column-map.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)

## Out of scope / follow-ups

- Auto category from description (next slice)
- FR-019 bank/broker `/import`
- Force overwrite / ImportBatchRow fingerprints
