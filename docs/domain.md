# Domain model

Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

## Core entities

| Model | Purpose | Scoped by |
|-------|---------|-----------|
| `User` | Email + `passwordHash` | — |
| `Transaction` | Cash flows (`INCOME`, `EXPENSE`, `TRANSFER_TO_PORTFOLIO`) | `userId`; optional `portfolioId`, `accountId`, `categoryId`, `importHash` (CSV dedup) |
| `InvestmentPortfolio` | Brokerage account (`name`, `baseCurrency`, `cashBalance`) | `userId`; unique `[userId, name]` |
| `PortfolioTrade` | BUY/SELL lots per symbol inside a portfolio | `userId` + `portfolioId` |
| `FinancialAccount` | Bank, real estate, crypto, liability, bonds wrapper | `userId`; `type` + unique `[userId, name]` |
| `Category` | Income/expense tree (`parentId`, `kind`) | `userId` |
| `BondHolding` | Treasury bond line (series, nominal) on `BONDS` account | `accountId` |
| `Budget` | Monthly limit (`yearMonth` `YYYY-MM`, optional root `categoryId` / legacy `category` string) | `userId` |
| `MarketPriceSnapshot` | Latest close per symbol (valuation) | Global |
| `MarketPriceHistory` | Historical closes for charts | Global |

## Portfolio model (brokerage)

Investment workflow is **trade-based**:

1. User creates `InvestmentPortfolio` records (`/api/portfolios`).
2. Trades (`PortfolioTrade`) are recorded via `POST /api/portfolio` (BUY/SELL).
3. `GET /api/portfolio?portfolioId=&currency=` aggregates trades per symbol, applies market snapshots and FX.

Cash balance on `InvestmentPortfolio` is maintained via `backend/src/portfolioCash.ts` and `TRANSFER_TO_PORTFOLIO` transactions.

Valuation helpers: `backend/src/portfolioValuation.ts`, net worth: `backend/src/netWorth.ts`.

## Financial accounts

| `type` | Balance / value |
|--------|-----------------|
| `BANK` | `openingBalance` + INCOME − EXPENSE on linked transactions |
| `REAL_ESTATE`, `CRYPTO`, `LIABILITY` | `manualValue` (liabilities subtracted in net worth) |
| `BONDS` | Sum of `BondHolding.nominal` synced to `manualValue` |

## Categories

- Hierarchical via `Category.parentId`.
- Transactions store denormalized `category` path string and optional `categoryId`.
- Stats charts roll up amounts to root category name.
- Budgets reference a **root** expense category via `categoryId`; progress includes all expenses whose path starts with that root (subcategories included).

## Data migration

- `npm run db:migrate-categories` (backend): backfill `categoryId` on transactions and budgets from legacy `category` strings; ensures „Niesklasyfikowane” nodes.

## Legacy: `PortfolioPosition`

`PortfolioPosition` remains in the schema for older data but **new UI/API flows use `PortfolioTrade` + `InvestmentPortfolio`**.

## Transaction types

- `INCOME` / `EXPENSE` — cashflow and bank balances.
- `TRANSFER_TO_PORTFOLIO` — increases brokerage cash; requires `portfolioId`.

## Market data

- Snapshots keyed by `symbol`, `priceDate`, `source`.
- Staleness/expiry logic in `marketData.ts`.
- Manual refresh: `POST /api/market-data/refresh`.

## Related docs

- [api.md](api.md) — HTTP surface
- [architecture.md](architecture.md) — auth and FX flow
