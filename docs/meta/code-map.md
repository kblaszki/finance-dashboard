---
diataxis: meta
use_when: Locate primary code paths by domain before editing
audience: agent
related_docs:
  - docs/README.md
  - AGENTS.md
---

# Code map

Curated domain → code entry points. Cap kept small on purpose — update a row when a primary path moves.

| Domain / concern | Primary paths | Related doc |
|------------------|---------------|-------------|
| App wiring | `backend/src/app.ts`, `backend/src/routes/mountRouters.ts` | [architecture](../explanation/architecture.md) |
| Auth / JWT | `backend/src/auth.ts`, `backend/src/routes/authRoutes.ts`, `frontend/src/state/auth.tsx`, `frontend/src/api/authApi.ts` | [architecture](../explanation/architecture.md), [api](../reference/api.md) |
| HTTP helpers | `backend/src/routes/httpSupport.ts`, `backend/src/routes/routeSupport.ts` | [fullstack-practices](../explanation/fullstack-practices.md) |
| Accounts | `backend/src/routes/accountsRoutes.ts`, `backend/src/accountStats.ts`, `backend/src/manualAccountRevalue.ts`, `frontend/src/api/accountsApi.ts` | [accounts-and-holdings](../how-to/accounts-and-holdings.md), [domain](../reference/domain.md) |
| Account types | `backend/src/accountTypes.ts`, `frontend/src/state/accountTypes.ts` | [domain](../reference/domain.md) |
| Transactions | `backend/src/routes/transactionsRoutes.ts`, `backend/src/transactionBalance.ts`, `frontend/src/api/transactionsApi.ts` | [api](../reference/api.md) |
| Holdings / lots | `backend/src/routes/holdingsRoutes.ts`, `backend/src/holdingLot.ts`, `backend/src/holdings.ts`, `frontend/src/api/holdingsApi.ts`, `holdingLotsApi.ts` | [accounts-and-holdings](../how-to/accounts-and-holdings.md), [domain](../reference/domain.md) |
| Asset trades | `backend/src/routes/assetTradesRoutes.ts`, `backend/src/assetTrades.ts`, `frontend/src/api/assetTradesApi.ts` | [accounts-and-holdings](../how-to/accounts-and-holdings.md) |
| Internal transfers | `backend/src/routes/internalTransfersRoutes.ts`, `backend/src/internalTransfers.ts`, `frontend/src/api/internalTransfersApi.ts` | [internal-transfers](../how-to/internal-transfers.md) |
| Position transfers | `backend/src/routes/positionTransfersRoutes.ts`, `backend/src/positionTransfers.ts`, `frontend/src/api/positionTransfersApi.ts` | [position-transfers](../how-to/position-transfers.md) |
| Corporate actions | `backend/src/routes/corporateActionsRoutes.ts`, `backend/src/corporateActions.ts`, `backend/src/stockSplit.ts`, `frontend/src/api/corporateActionsApi.ts` | [corporate-actions](../how-to/corporate-actions.md) |
| Portfolio | `backend/src/routes/portfolioRoutes.ts`, `backend/src/portfolio.ts`, `frontend/src/api/portfolioApi.ts` | [frontend](../reference/frontend.md) |
| Portfolio stats | `backend/src/portfolioStats.ts`, `backend/src/stats.ts`, `backend/src/routes/statsRoutes.ts` | [portfolio-stats](../explanation/portfolio-stats.md) |
| FX | `backend/src/fx.ts` only | [architecture](../explanation/architecture.md) |
| Valuations | `backend/src/accountValuation.ts`, `frontend/src/api/valuationsApi.ts` | [domain](../reference/domain.md) |
| Net worth / stats | `backend/src/netWorth.ts`, `backend/src/stats.ts`, `backend/src/routes/statsRoutes.ts`, `frontend/src/api/statsApi.ts` | [api](../reference/api.md), [portfolio-stats](../explanation/portfolio-stats.md) |
| Market data | `backend/src/marketData/`, `backend/src/routes/marketDataRoutes.ts`, `backend/src/scripts/marketSync.ts`, `frontend/src/api/marketDataApi.ts` | [market-data-sync](../how-to/market-data-sync.md), [architecture](../explanation/architecture.md) |
| Import (broker/bank) | `backend/src/import/`, `backend/src/routes/importRoutes.ts`, `backend/src/routes/importPresetsRoutes.ts`, `frontend/src/api/importApi.ts`, `frontend/src/features/import/` | [import-csv](../how-to/import-csv.md) |
| Tax (PL) | `backend/src/tax/`, `backend/src/routes/statsRoutes.ts`, `backend/src/routes/taxLossCarryforwardRoutes.ts`, `backend/src/routes/taxCalendarRoutes.ts`, `backend/src/routes/taxWrappersRoutes.ts`, `backend/src/routes/propertySalesRoutes.ts`, `backend/src/routes/documentAttachmentsRoutes.ts`, `frontend/src/features/tax/` | [tax-year-workflow](../how-to/tax-year-workflow.md), [tax-pl](../explanation/tax-pl.md) |
| Categories / budgets | `backend/src/categories.ts`, `backend/src/budgets.ts`, `backend/src/budgetAlerts.ts`, `backend/src/categorizationRules.ts`, `backend/src/routes/categoriesRoutes.ts`, `backend/src/routes/budgetsRoutes.ts`, `backend/src/routes/categorizationRulesRoutes.ts`, `frontend/src/api/categoriesApi.ts`, `budgetsApi.ts`, `categorizationRulesApi.ts` | [budgets-and-categories](../how-to/budgets-and-categories.md) |
| Income / coupons | `backend/src/incomeEvents.ts`, `backend/src/couponSchedules.ts`, matching routes + `frontend/src/api/incomeEventsApi.ts`, `couponSchedulesApi.ts` | [income-and-coupons](../how-to/income-and-coupons.md) |
| Liabilities | `backend/src/liabilities.ts`, `backend/src/routes/liabilitiesRoutes.ts`, `frontend/src/api/liabilitiesApi.ts` | [domain](../reference/domain.md) |
| Property | `backend/src/propertyCashFlows.ts`, `backend/src/propertySales.ts`, `backend/src/assetValuations.ts`, matching routes + APIs | [property-tracking](../how-to/property-tracking.md) |
| Account sync / bank | `backend/src/accountSync.ts`, `backend/src/bankConnections.ts`, `backend/src/routes/accountSyncRoutes.ts`, `backend/src/routes/bankConnectionsRoutes.ts` | [account-sync](../how-to/account-sync.md) |
| Export / audit | `backend/src/dataExport.ts`, `backend/src/auditLog.ts`, `backend/src/routes/exportRoutes.ts`, `frontend/src/api/exportApi.ts` | [data-export](../how-to/data-export.md) |
| Frontend shell | `frontend/src/App.tsx`, `frontend/src/api/client.ts`, `frontend/src/hooks/useAsyncData.ts` | [frontend](../reference/frontend.md) |
| Prisma schema | `backend/prisma/schema.prisma` | [domain](../reference/domain.md) |
| Demo seed | `backend/prisma/seed.ts`, `backend/prisma/demo/` | [demo-seed](../tutorials/demo-seed.md) |
| Tests / CI | `backend/test/`, `frontend/src/**/*.{test.ts,test.tsx}`, `.github/workflows/ci.yml` | [testing](../reference/testing.md) |

Hub: [docs/README.md](../README.md).
