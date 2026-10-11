---
id: MVP-015
status: done
domain: cash-transfers
title: Transfers CSV export and mapped import
---

# Transfers CSV export and mapped import

## Summary

User-scoped CSV export/import of internal cash transfers. Accounts are identified by name + currency (no DB ids). Import requires mapping every file account onto an existing owned account; likely duplicates are flagged and skipped by default.

## User value

Move or restore transfer history between environments without touching ledger CSV (which rejects `TRANSFER_*` rows).

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/transfers` — Download/Upload CSV; `TransferImportPanel` (map accounts → review rows) |
| API | `GET /api/transfers/export`, `POST /api/transfers/import/preview`, `POST /api/transfers/import` |
| Code | `domain/transfersCsv.ts`, `domain/transfersImport.ts`, `transfersRoutes.ts`, `transfersApi.ts` |

## Acceptance

- [x] Owner exports all own transfers as CSV (oldest→newest); empty = header only
- [x] Import identifies accounts by `(name, currency)`; map-only (no account create)
- [x] Preview suggests exact name+currency matches; Import blocked until every account is mapped
- [x] After mappings, preview marks exact duplicates vs existing transfers; unchecked by default
- [x] Import creates transfers via `createTransfer` (legs + balances); all-or-nothing
- [x] `skipRows` omits selected rows; response `{ created, skipped }`
- [x] Unauthenticated → 401; incomplete/wrong mappings → 400

## Implementation notes

- Docs: [docs/reference/api.md](../../../docs/reference/api.md), [docs/how-to/internal-transfers.md](../../../docs/how-to/internal-transfers.md)
- Migration order when restoring a user: accounts → transfers → ledger INCOME/EXPENSE

## Out of scope / follow-ups

- Creating accounts from import
- Fuzzy account matching / saved mapping presets
- In-file duplicate detection
