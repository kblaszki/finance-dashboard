---
diataxis: meta
use_when: Locate primary code paths for auth and accounts modules
audience: agent
related_docs:
  - docs/README.md
  - docs/explanation/architecture.md
---

# Code map

Hub: [docs/README.md](../README.md).

JWT auth, multi-type accounts, category tree + tags, cash ledger + transfers, CSV import, statistics, NBP FX. Remaining product backlog: [mvp/](../../mvp/).

| Area | Primary paths |
|------|----------------|
| Express app / health | `backend/src/app.ts`, `backend/src/httpConfig.ts` |
| JWT auth helpers | `backend/src/auth.ts`, `backend/src/authConfig.ts` |
| Auth HTTP routes | `backend/src/routes/authRoutes.ts` |
| Accounts HTTP routes | `backend/src/routes/accountsRoutes.ts` |
| Categories HTTP routes | `backend/src/routes/categoriesRoutes.ts` |
| Tags HTTP routes | `backend/src/routes/tagsRoutes.ts` |
| Cash transactions routes | `backend/src/routes/cashTransactionsRoutes.ts` (CRUD + CSV export; month list capped) |
| Cash ledger CSV import routes | `backend/src/routes/cashImportRoutes.ts` (preview/commit ledger + columns; description suggest) |
| Owned-account helper | `backend/src/domain/ownedAccount.ts` |
| Soft row caps | `backend/src/domain/rowCaps.ts` (export, balance-history, stats period) |
| CSV import presets routes | `backend/src/routes/csvImportPresetsRoutes.ts` |
| Category description rules routes | `backend/src/routes/categoryDescriptionRulesRoutes.ts` |
| Transfers routes | `backend/src/routes/transfersRoutes.ts` |
| Statistics routes | `backend/src/routes/statisticsRoutes.ts` |
| Account type allow-list | `backend/src/domain/accountTypes.ts` |
| Categories domain | `backend/src/domain/categories.ts` |
| Tags domain | `backend/src/domain/tags.ts` |
| Cash ledger domain | `backend/src/domain/cashLedger.ts`, `money.ts`, `cashLedgerCsv.ts`, `cashLedgerCsvImport.ts`, `cashLedgerImportService.ts`, `csvColumnMap.ts`, `csvImportPresets.ts`, `cashImportDedup.ts`, `categoryDescriptionSuggest.ts` |
| Cash transfers domain | `backend/src/domain/cashTransfers.ts`, `transfersImport.ts`, `transfersImportService.ts`, `transfersCsv.ts` |
| Category breakdown domain | `backend/src/domain/categoryBreakdown.ts` |
| Stats period (M/Q/Y) | `backend/src/domain/statsPeriod.ts` |
| Tag breakdown domain | `backend/src/domain/tagBreakdown.ts` |
| Cashflow stats domain | `backend/src/domain/cashflowStats.ts` |
| Account balance history domain | `backend/src/domain/accountBalanceHistory.ts` |
| Net worth domain | `backend/src/domain/netWorth.ts` |
| FX / NBP rates | `backend/src/domain/fx.ts`, `fxRates.ts`, `nbpClient.ts` |
| FX sync CLI | `backend/src/scripts/syncFxRates.ts` |
| Router mount | `backend/src/routes/mountRouters.ts` |
| HTTP helpers / errors | `backend/src/routes/httpSupport.ts`, `backend/src/lib/errors.ts` |
| Route uid helper | `backend/src/routes/routeSupport.ts` |
| Prisma schema | `backend/prisma/schema.prisma` (`User`, `Category`, `CategoryDescriptionRule`, `Tag`, `CashTransactionTag`, `Account`, `CashTransfer`, `CashTransaction`, `CsvImportPreset`, `ImportBatch`, `FxRateDaily`) |
| Migrations | `backend/prisma/migrations/` |
| Demo user seed | `backend/prisma/seed.ts`, `backend/src/domain/seedDemoPortfolio.ts` |
| Create user CLI | `backend/src/scripts/createUser.ts` |
| DB backup CLI | `backend/src/scripts/backupDb.ts` |
| SQLite path helper | `backend/src/dbPath.ts` |
| HTTP / schema tests | `backend/test/httpHarness.ts`, `auth.http.test.ts`, `accounts.http.test.ts` (+ `ledgerImport` / `categories` / `transfers` / `statistics` HTTP suites), `schema.integration.test.ts`, `migrateDeploy.test.ts` |
| Test Prisma helper | `backend/test/prismaTestClient.ts`, `setupTestEnv.ts` |
| SPA routes | `frontend/src/App.tsx` |
| Auth state | `frontend/src/state/auth.tsx` |
| Currency state | `frontend/src/state/currency.tsx` |
| Auth API client | `frontend/src/api/authApi.ts`, `frontend/src/api/client.ts` |
| Accounts API client | `frontend/src/api/accountsApi.ts` |
| Categories API client | `frontend/src/api/categoriesApi.ts` |
| Description rules API client | `frontend/src/api/categoryDescriptionRulesApi.ts` |
| Tags API client | `frontend/src/api/tagsApi.ts` |
| Transactions API client | `frontend/src/api/transactionsApi.ts` (incl. import presets + column map) |
| Statistics API client | `frontend/src/api/statisticsApi.ts` |
| Shell / gates | `frontend/src/components/AppShell.tsx`, `AuthSwapShell.tsx`, `ProtectedRoute.tsx`, `ErrorBoundary.tsx` |
| Shared UI | `frontend/src/components/ui/{PageHeader,KpiCard,ChartCard,StatusBlock,CurrencySelect}.tsx` |
| Pages | `frontend/src/pages/{Landing,Login,Register,Dashboard,Accounts,AccountDetail,Categories,Tags,Transfers,Statistics,Settings}Page.tsx` |
| Statistics UI | `frontend/src/components/statistics/`, `frontend/src/utils/statisticsPeriod.ts`, `statisticsRollup.ts` |
| Cash ledger import hook | `frontend/src/hooks/useCashLedgerImport.ts` (AccountDetail CSV flow) |
| Transfers import hook | `frontend/src/hooks/useTransferImport.ts`; `components/transfers/{TransferTable,TransferCreateRow,TransferImportPanel,TransferFilterBar}.tsx` |
| Transfers API client | `frontend/src/api/transfersApi.ts` |
| Account ledger UI | `frontend/src/components/account/` |
| Theme | `frontend/src/state/theme.tsx`, `ThemeToggle.tsx` (light/dark) |
| CSS layers / tokens | `frontend/src/styles/` (`tokens`, `base`, `layout`, `components/*`, `pages/*`, `utilities`) |
