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

## Accounts (unified bank + brokerage)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts` | Yes | `?scope=managed&types=BANK,BROKERAGE` — unified list with `balance`; legacy `FinancialAccount` without scope |
| POST | `/api/accounts` | Yes | Create `BANK` or `BROKERAGE` (unified), or legacy types (`REAL_ESTATE`, …) |
| PUT | `/api/accounts/:id` | Yes | Update legacy financial account |
| DELETE | `/api/accounts/:id` | Yes | Delete |
| GET | `/api/accounts/:id/balance-history` | Yes | Daily balance series; optional `from`, `to` |
| GET | `/api/accounts/:id/transactions` | Yes | Bank INCOME/EXPENSE on account |
| GET | `/api/accounts/:id/trades` | Yes | Brokerage trades on account |
| GET | `/api/accounts/:id/bonds` | Yes | List bond holdings (legacy financial account) |
| POST | `/api/accounts/:id/bonds` | Yes | Add bond holding |
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
| POST | `/api/transactions` | Yes | Create; `categoryId` or `category`; `accountId` must be user’s `BANK` account when set |
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

## Stats (dashboard)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stats/summary` | Yes | Cashflow KPIs + broker total; `from`, `to`, `currency` |
| GET | `/api/stats/net-worth` | Yes | Full net worth breakdown; `currency` |
| GET | `/api/stats/portfolio-value-over-time` | Yes | Monthly broker wealth; `from`, `to`, `currency` |
| GET | `/api/stats/expenses-by-category` | Yes | Expense breakdown (root rollup) |
| GET | `/api/stats/income-by-category` | Yes | Income breakdown (root rollup) |
| GET | `/api/stats/cashflow-over-time` | Yes | Monthly cash flow series |
## Import

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/import/csv/presets` | Yes | Bank CSV presets (`mbank`, `ing`, `generic_pl`) |
| POST | `/api/import/csv/preview` | Yes | Preview: max 50 rows, income/expense sums, max 20 errors |
| POST | `/api/import/csv` | Yes | Import into bank `accountId`; `{ imported, skipped }` (idempotent via `importHash`) |
| POST | `/api/import/broker-csv/preview` | Yes | Preview broker trades CSV |
| POST | `/api/import/broker-csv` | Yes | Import `PortfolioTrade` rows; `{ imported, skipped, errors }` |

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
| `frontend/src/api/statsApi.ts` | Stats routes |

When adding a route, add one row here and a matching function in the appropriate `*Api.ts` file.
