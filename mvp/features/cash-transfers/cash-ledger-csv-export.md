---
id: MVP-013
status: done
domain: cash-transfers
title: Cash ledger CSV export
---

# Cash ledger CSV export

## Summary

Per-account CSV download of cash ledger rows for any allow-listed account type. Export-only (no import). UTF-8, RFC4180, oldest→newest.

## User value

Users can take a portable snapshot of an account’s cash movements for spreadsheets or backup without a full-database dump.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/accounts/:id` — Download CSV on `AccountDetailPage` |
| API | `GET /api/accounts/:accountId/transactions/export` |
| Code | `domain/cashLedgerCsv.ts`; `cashTransactionsRoutes.ts`; `transactionsApi.exportTransactionsCsv` |

## Acceptance

- [x] Owner downloads CSV of all cash txs for any owned allow-listed account
- [x] Unauthenticated → 401; unknown/unowned → 404; malformed id → 400
- [x] Stable header; RFC4180 escaping; category name when tagged; Excel formula neutralization
- [x] Empty ledger returns header-only CSV (`200`)
- [x] UI Download CSV on account detail

## Implementation notes

- Docs: [docs/reference/api.md](../../../docs/reference/api.md), [docs/reference/frontend.md](../../../docs/reference/frontend.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)
- Not NFR-002 (full JSON) or FR-019 (CSV import)

## Out of scope / follow-ups

- Bank/broker CSV import — [FR-019](../import/csv-import-bank-broker.md)
- Full user JSON export — [NFR-002](../automation-export/full-json-export.md)
