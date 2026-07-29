---
diataxis: how-to
use_when: Import broker or bank CSV into accounts
audience: both
related_docs:
  - docs/reference/api.md
  - docs/reference/domain.md
  - docs/reference/frontend.md
related_code:
  - backend/src/import/
  - backend/src/routes/importRoutes.ts
  - backend/src/routes/importPresetsRoutes.ts
  - frontend/src/features/import/
---

# Import broker or bank CSV

Hub: [docs/README.md](../README.md).

Idempotent CSV import for brokerage trades (XTB) and bank cash rows. Dry-run first, then commit.

## Broker trades (XTB)

1. Target account must be `BROKERAGE` owned by the current user.
2. UI: `/import` or account detail (`BrokerImportForm`) — or `POST /api/import/broker-trades`.
3. Query/body: `accountId`, `broker=xtb` (only supported broker today), optional `dryRun=true|1`.
4. Body: `{ csv, filename? }` (CSV text, not multipart).
5. Dry-run returns parsed/skipped counts without writing. Commit creates `ImportBatch` / `ImportRow` (`externalHash` per account) and applies rows as `HoldingLot` trades or cash `Transaction` (dividends, interest, transfers).
6. Domain notes: [domain.md — CSV import (XTB)](../reference/domain.md#csv-import-xtb).

Parsers live in `backend/src/import/` (`xtbParser.ts`, `importTrades.ts`). Routes: `importRoutes.ts`.

## Bank transactions

1. Target account: cash/bank account for the user.
2. UI: `/import` — or `POST /api/import/bank-transactions`.
3. Query/body: `accountId`, `bank=mbank|generic`, optional `dryRun=true|1`.
4. Body: `{ csv, filename? }`.
5. Commit skips duplicates via `ImportRow` hashes; may apply `CategorizationRule` patterns → `categoryId`.

Parsers: `bankParser.ts`, `importBankTransactions.ts`.

## Import presets

- List/create custom broker column maps: `GET/POST /api/import/presets`; delete custom: `DELETE /api/import/presets/:id`.
- UI: `/import/presets` (`ImportPresetsPage`). Built-in presets are not deletable.

## Agent checklist

| Area | Path |
|------|------|
| Domain | `backend/src/import/` |
| HTTP | `importRoutes.ts`, `importPresetsRoutes.ts` |
| Clients | `frontend/src/api/importApi.ts`, `importPresetsApi.ts` |
| UI | `frontend/src/features/import/` |
| Catalog | [api.md](../reference/api.md) Import rows |
