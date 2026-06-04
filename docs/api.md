# API catalog

Implementation: [`backend/src/app.ts`](../backend/src/app.ts). Auth: `requireAuth` = Bearer JWT unless noted.

## Health and auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Liveness check |
| POST | `/api/auth/register` | No | Create user; returns token |
| POST | `/api/auth/login` | No | Login; returns token |
| GET | `/api/auth/me` | Yes | Current user profile |

## Investment portfolios (brokerage)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portfolios` | Yes | List user portfolios |
| POST | `/api/portfolios` | Yes | Create portfolio |
| PUT | `/api/portfolios/:id` | Yes | Update name/base currency |
| DELETE | `/api/portfolios/:id` | Yes | Delete portfolio |

## Financial accounts (bank, assets, bonds, liabilities)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts` | Yes | List; optional `type` |
| POST | `/api/accounts` | Yes | Create (`BANK`, `REAL_ESTATE`, `CRYPTO`, `LIABILITY`, `BONDS`) |
| PUT | `/api/accounts/:id` | Yes | Update |
| DELETE | `/api/accounts/:id` | Yes | Delete (no linked transactions) |
| GET | `/api/accounts/:id/bonds` | Yes | List bond holdings |
| POST | `/api/accounts/:id/bonds` | Yes | Add bond holding; syncs account `manualValue` |
| DELETE | `/api/bonds/:id` | Yes | Delete bond holding |

## Categories

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/categories` | Yes | Tree nodes with `path`; optional `kind` |
| POST | `/api/categories` | Yes | Create (`INCOME` / `EXPENSE`, optional `parentId`) |
| PUT | `/api/categories/:id` | Yes | Update |
| DELETE | `/api/categories/:id` | Yes | Delete (no children) |

## Transactions (cash)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transactions` | Yes | List; `from`, `to`, `type`, `portfolioId`, `accountId` |
| POST | `/api/transactions` | Yes | Create; `categoryId` or `category`; optional `accountId` |
| PUT | `/api/transactions/:id` | Yes | Update |
| DELETE | `/api/transactions/:id` | Yes | Delete |

## Portfolio positions (trades)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portfolio` | Yes | Aggregated positions; `portfolioId`, optional `currency` |
| POST | `/api/portfolio` | Yes | Record BUY/SELL trade |
| GET | `/api/portfolio/trades` | Yes | Raw trades; `portfolioId`, optional `symbol` |
| PUT | `/api/portfolio/:id` | Yes | Update trade; SELL validated vs holdings (400 + `availableQuantity`) |
| DELETE | `/api/portfolio/:id` | Yes | Delete trade; recalculates portfolio cash |
| GET | `/api/portfolio/:symbol/history` | Yes | Price history for symbol analysis |

## Budgets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/budgets` | Yes | List; optional `yearMonth` |
| POST | `/api/budgets` | Yes | Create budget |
| PUT | `/api/budgets/:id` | Yes | Update |
| DELETE | `/api/budgets/:id` | Yes | Delete |

## Stats (dashboard)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stats/summary` | Yes | Cashflow KPIs + broker total; `from`, `to`, `currency` |
| GET | `/api/stats/net-worth` | Yes | Full net worth breakdown; `currency` |
| GET | `/api/stats/portfolio-value-over-time` | Yes | Monthly broker wealth; `from`, `to`, `currency` |
| GET | `/api/stats/expenses-by-category` | Yes | Expense breakdown (root rollup) |
| GET | `/api/stats/income-by-category` | Yes | Income breakdown (root rollup) |
| GET | `/api/stats/cashflow-over-time` | Yes | Monthly cash flow series |
| GET | `/api/stats/budget-progress` | Yes | Spent vs limit; `yearMonth`, `currency` |

## Import

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/import/csv/preview` | Yes | Parse CSV with column mapping |
| POST | `/api/import/csv` | Yes | Import rows into bank `accountId` |

## FX and market data

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/fx/rates` | No | PLN-based FX table |
| POST | `/api/market-data/refresh` | Yes | Refresh quotes for user symbols |

## Frontend clients

| API module | Covers |
|------------|--------|
| `frontend/src/api/authApi.ts` | Auth routes |
| `frontend/src/api/transactionsApi.ts` | Transactions |
| `frontend/src/api/portfoliosApi.ts` | `/api/portfolios` |
| `frontend/src/api/portfolioApi.ts` | `/api/portfolio`, trades, history, market refresh |
| `frontend/src/api/accountsApi.ts` | `/api/accounts` |
| `frontend/src/api/categoriesApi.ts` | `/api/categories` |
| `frontend/src/api/bondsApi.ts` | Bond holdings |
| `frontend/src/api/importApi.ts` | CSV import |
| `frontend/src/api/budgetsApi.ts` | Budgets + budget progress |
| `frontend/src/api/statsApi.ts` | Stats routes |

When adding a route, add one row here and a matching function in the appropriate `*Api.ts` file.
