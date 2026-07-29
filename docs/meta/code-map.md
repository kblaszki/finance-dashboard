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
| Accounts | `backend/src/routes/accountsRoutes.ts`, `backend/src/accountStats.ts`, `frontend/src/api/accountsApi.ts` | [api](../reference/api.md), [domain](../reference/domain.md) |
| Account types | `backend/src/accountTypes.ts`, `frontend/src/state/accountTypes.ts` | [domain](../reference/domain.md) |
| Transactions | `backend/src/routes/transactionsRoutes.ts`, `backend/src/transactionBalance.ts`, `frontend/src/api/transactionsApi.ts` | [api](../reference/api.md) |
| Holdings / lots | `backend/src/routes/holdingsRoutes.ts`, `backend/src/holdingLot.ts`, `backend/src/holdings.ts`, `frontend/src/api/holdingsApi.ts` | [domain](../reference/domain.md) |
| Asset trades | `backend/src/routes/assetTradesRoutes.ts`, `backend/src/assetTrades.ts`, `frontend/src/api/assetTradesApi.ts` | [api](../reference/api.md) |
| Internal transfers | `backend/src/routes/internalTransfersRoutes.ts`, `backend/src/internalTransfers.ts` | [api](../reference/api.md) |
| Portfolio | `backend/src/routes/portfolioRoutes.ts`, `backend/src/portfolio.ts`, `frontend/src/api/portfolioApi.ts` | [frontend](../reference/frontend.md) |
| FX | `backend/src/fx.ts` only | [architecture](../explanation/architecture.md) |
| Valuations | `backend/src/accountValuation.ts`, `frontend/src/api/valuationsApi.ts` | [domain](../reference/domain.md) |
| Net worth / stats | `backend/src/netWorth.ts`, `backend/src/stats.ts`, `backend/src/routes/statsRoutes.ts`, `frontend/src/api/statsApi.ts` | [api](../reference/api.md) |
| Market data | `backend/src/marketData/`, `backend/src/routes/marketDataRoutes.ts`, `frontend/src/api/marketDataApi.ts` | [architecture](../explanation/architecture.md) |
| Import (broker/bank) | `backend/src/import/`, `backend/src/routes/` import routes, `frontend/src/api/importApi.ts`, `frontend/src/features/import/` | [domain](../reference/domain.md) |
| Tax (PL) | `backend/src/tax/`, tax routes under `backend/src/routes/`, `frontend/src/features/tax/` | [tax-pl](../explanation/tax-pl.md) |
| Categories / budgets | `backend/src/categories.ts`, `backend/src/budgets.ts`, matching routes + `frontend/src/api/*` | [api](../reference/api.md) |
| Income / liabilities | `backend/src/incomeEvents.ts`, `backend/src/liabilities.ts` | [domain](../reference/domain.md) |
| Property | `backend/src/propertyCashFlows.ts`, `backend/src/propertySales.ts`, `backend/src/assetValuations.ts` | [domain](../reference/domain.md) |
| Frontend shell | `frontend/src/App.tsx`, `frontend/src/api/client.ts`, `frontend/src/hooks/useAsyncData.ts` | [frontend](../reference/frontend.md) |
| Prisma schema | `backend/prisma/schema.prisma` | [domain](../reference/domain.md) |
| Demo seed | `backend/prisma/seed.ts`, `backend/prisma/demo/` | [demo-seed](../tutorials/demo-seed.md) |
| Tests / CI | `backend/test/`, `frontend/src/**/*.test.ts`, `.github/workflows/ci.yml` | [testing](../reference/testing.md) |

Hub: [docs/README.md](../README.md).
