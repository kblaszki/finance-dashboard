# Domain model

Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

## Core entities

| Model | Purpose | Scoped by |
|-------|---------|-----------|
| `User` | Email + `passwordHash` | — |
| `Transaction` | Cash income/expense (`type`, `amount`, `category`, `date`) | `userId`; optional `portfolioId` link |
| `InvestmentPortfolio` | Named portfolio (`name`, `baseCurrency`, `cashBalance`) | `userId`; unique `[userId, name]` |
| `PortfolioTrade` | BUY/SELL lots per symbol inside a portfolio | `userId` + `portfolioId` |
| `Budget` | Monthly limit (`yearMonth` `YYYY-MM`, optional `category`) | `userId`; unique `[userId, yearMonth, category]` |
| `MarketPriceSnapshot` | Latest close per symbol (valuation) | Global (not per user) |
| `MarketPriceHistory` | Historical closes for charts | Global |

## Portfolio model (current)

Investment workflow is **trade-based**:

1. User creates `InvestmentPortfolio` records (`/api/portfolios`).
2. Trades (`PortfolioTrade`) are recorded via `POST /api/portfolio` (BUY/SELL).
3. `GET /api/portfolio?portfolioId=&currency=` aggregates trades per symbol, applies market snapshots and FX, returns position rows (not raw DB rows).

Cash balance on `InvestmentPortfolio` is maintained via `backend/src/portfolioCash.ts` and linked cash `Transaction` rows where applicable.

## Legacy: `PortfolioPosition`

`PortfolioPosition` remains in the schema for older data but **new UI/API flows use `PortfolioTrade` + `InvestmentPortfolio`**. Do not add features on `PortfolioPosition` unless migrating legacy data.

## Budget categories

- Empty `category` in DB (`""`) means overall monthly budget.
- API exposes `category: null` for overall via `budgetCategoryFromDb` / `budgetCategoryToDb` in `app.ts`.

## Transaction types

- `INCOME` / `EXPENSE` (string on `Transaction.type`).
- Stats and dashboard aggregate by type and date range (`from` / `to` query params).

## Market data

- Snapshots keyed by `symbol`, `priceDate`, `source`.
- Staleness/expiry logic in `marketData.ts` (`classifyMarketDataStatus`).
- Manual refresh: `POST /api/market-data/refresh` (per-user cooldown).

## Related docs

- [api.md](api.md) — HTTP surface
- [architecture.md](architecture.md) — auth and FX flow
