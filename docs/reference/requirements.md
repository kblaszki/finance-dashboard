---
diataxis: reference
use_when: FR/NFR traceability — shipped vs mvp backlog
audience: both
related_docs:
  - mvp/CHECKLIST.md
  - docs/reference/api.md
---

# Requirements map

Hub: [docs/README.md](../README.md).

**Shipped in code** = auth + multi-type accounts + category tree + tags + cash ledger (optional `categoryId`, CSV export/import) + internal cash transfers + statistics (category breakdown, period KPIs, cashflow history, FX-aware net worth + history, rolling 12m averages) + NBP FX rate store/CLI below. Remaining backlog: [mvp/CHECKLIST.md](../../mvp/CHECKLIST.md) and `mvp/features/*`. Checklist: **28 done / 0 in_progress / 45 planned** (as of 2026-10-29; matches master table in CHECKLIST).

## Shipped

| ID | Capability | Code / docs |
|----|------------|-------------|
| MVP-001 | Login and register with JWT | [api.md](api.md) auth routes; [account-settings.md](../how-to/account-settings.md) |
| MVP-002 | Profile, email, password settings | `/settings`; auth PATCH routes |
| MVP-050 | Health endpoint | `GET /api/health` |
| MVP-051 | Private deploy tooling | `create-user`, `db:backup`, [private-deploy.md](../how-to/private-deploy.md) |
| MVP-052 | Production auth rate limits | `app.ts` (login, register, password, email share one limiter) |
| FR-006 | Extended account types | `Account` model; allow-list in `domain/accountTypes.ts` includes `CREDIT_CARD`, `IKE`, `IKZE`, `TREASURY_BONDS`; `/api/accounts`; `/accounts` UI type select — type-specific fields still planned |
| MVP-011 | Cash ledger INCOME/EXPENSE | `CashTransaction`; `domain/cashLedger.ts`; `/api/accounts/:id/transactions`; `/accounts/:id` |
| MVP-013 | Cash ledger CSV export | `GET /api/accounts/:id/transactions/export`; `domain/cashLedgerCsv.ts`; Download CSV on `/accounts/:id` |
| MVP-014 | Cash ledger CSV import | `POST /api/accounts/:id/transactions/import`; `domain/cashLedgerCsvImport.ts`; Upload CSV on `/accounts/:id` |
| MVP-022 | Generic CSV column map on account | `POST …/import/columns/{preview,apply,commit}`; `domain/csvColumnMap.ts`; `ImportColumnMappingPanel` on `/accounts/:id` |
| MVP-023 | Account CSV import column presets | `CsvImportPreset`; `…/import-presets` CRUD; `matchingPresetId` on columns preview; save/load in `ImportColumnMappingPanel` |
| MVP-024 | Cash ledger import dedup + ImportBatch | `domain/cashImportDedup.ts`; skip duplicates on preview/commit; `ImportBatch` audit on commit |
| MVP-025 | Import category suggest from description | `CategoryDescriptionRule`; `domain/categoryDescriptionSuggest.ts`; import `descriptionSuggestions` / `descriptionMappings`; rules CRUD |
| FR-015 | Category tree CRUD | `Category`; `domain/categories.ts`; `/api/categories`; `/categories`; empty on register (user-defined) |
| FR-018 | Transaction categories | Optional `CashTransaction.categoryId` on ledger create/list; multi-line splits deferred |
| FR-016 | Category spend breakdown | `GET /api/statistics/category-breakdown`; `/statistics` month Income/Expense lists (UTC, no FX) |
| FR-003 | Statistics period cashflow summary | `GET /api/statistics/period-summary`; `/statistics` income/expense/net KPIs for one currency |
| FR-004 | Cashflow history chart | `GET /api/statistics/cashflow-history`; `/statistics` Recharts series (`months` 6\|12\|24) |
| FR-002 | Net worth (cash buckets) | `GET /api/statistics/net-worth`; `/dashboard` byBucket after FX; `CREDIT_CARD` debt → `liabilities` (no holdings) |
| FR-005 | Rolling 12-month cashflow averages | `GET /api/statistics/cashflow-rolling-12m`; `/statistics` avg income/expense/net |
| FR-038 | Reporting-currency net-worth rollup + history | `GET /api/statistics/net-worth` + `net-worth-history`; NBP mid via PLN pivot into topbar currency; `/dashboard` WealthHero 6M/1Y/2Y chart |
| FR-011 | Internal cash transfers | `CashTransfer` + `TRANSFER_*` legs; `/api/transfers`; `/transfers`; [internal-transfers.md](../how-to/internal-transfers.md) |
| MVP-015 | Transfers CSV export and mapped import | `GET/POST /api/transfers/export|import`; `/transfers` Download/Upload CSV |
| MVP-016 | Categories CSV export and merge import | `GET/POST /api/categories/export|import`; `/categories` Download/Upload CSV |
| MVP-017 | Transfer category group (`TRANSFER` ledgerType) | `Category.ledgerType`; `/categories` Transfers section; optional `categoryId` on transfers |
| MVP-018 | Cash transaction tags | `Tag` + `CashTransactionTag`; `/tags`; ledger `tagIds`; `GET /api/statistics/tag-breakdown` |
| FR-012 | Accounts list type filter | `/accounts` UI filter by `accountType` (`filterAccountsByType`) |
| FR-010 | Historical NBP FX rates | `FxRateDaily`; `domain/fx.ts` + `fxRates.ts` + `nbpClient.ts`; `npm run fx:sync` (EUR/USD via PLN pivot); consumed by FR-038 |

## Planned / not in this codebase

| Area | Where to look |
|------|----------------|
| Password reset (MVP-003) | [mvp/features/auth/password-reset-api.md](../../mvp/features/auth/password-reset-api.md) |
| JWT HttpOnly cookie (MVP-004) | [mvp/features/auth/jwt-httponly-cookie.md](../../mvp/features/auth/jwt-httponly-cookie.md) |
| Holdings, tax, import, budgets, … | [mvp/CHECKLIST.md](../../mvp/CHECKLIST.md) |

Do not invent “implemented” rows for domain FRs until the feature ships and docs-sync updates this page.
