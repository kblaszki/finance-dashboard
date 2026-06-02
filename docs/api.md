# API catalog

Implementation: [`backend/src/app.ts`](../backend/src/app.ts). Auth: `requireAuth` = Bearer JWT unless noted.

## Health and auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Liveness check |
| POST | `/api/auth/register` | No | Create user; returns token |
| POST | `/api/auth/login` | No | Login; returns token |
| GET | `/api/auth/me` | Yes | Current user profile |

## Investment portfolios (accounts)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portfolios` | Yes | List user portfolios |
| POST | `/api/portfolios` | Yes | Create portfolio |
| PUT | `/api/portfolios/:id` | Yes | Update name/base currency |
| DELETE | `/api/portfolios/:id` | Yes | Delete portfolio |

## Transactions (cash)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transactions` | Yes | List; query `from`, `to`, `type`, `portfolioId` |
| POST | `/api/transactions` | Yes | Create income/expense |
| PUT | `/api/transactions/:id` | Yes | Update |
| DELETE | `/api/transactions/:id` | Yes | Delete |

## Portfolio positions (trades)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portfolio` | Yes | Aggregated positions; requires `portfolioId`, optional `currency` |
| POST | `/api/portfolio` | Yes | Record BUY/SELL trade |
| GET | `/api/portfolio/trades` | Yes | Raw trades; `portfolioId`, optional `symbol` |
| PUT | `/api/portfolio/:id` | Yes | Update trade by id |
| DELETE | `/api/portfolio/:id` | Yes | Delete trade |
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
| GET | `/api/stats/summary` | Yes | KPIs; `from`, `to`, `currency` |
| GET | `/api/stats/expenses-by-category` | Yes | Expense breakdown |
| GET | `/api/stats/income-by-category` | Yes | Income breakdown |
| GET | `/api/stats/cashflow-over-time` | Yes | Monthly cash flow series |
| GET | `/api/stats/budget-progress` | Yes | Spent vs limit; `yearMonth`, `currency` |

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
| `frontend/src/api/budgetsApi.ts` | Budgets + budget progress |
| `frontend/src/api/statsApi.ts` | Stats routes |

When adding a route, add one row here and a matching function in the appropriate `*Api.ts` file.
