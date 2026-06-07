# Domain model

Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

## Core entities

| Model | Purpose | Scoped by |
|-------|---------|-----------|
| `User` | Email + `passwordHash` | — |
| `Account` | Unified account (`BANK`, `BROKERAGE`, …) with `name`, `currency`, `notes` | `userId`; unique `[userId, name]` |
| `BankAccountDetails` | Opening balance for `BANK` accounts | `accountId` (1:1) |
| `BrokerageAccountDetails` | Base currency + cash balance for `BROKERAGE` | `accountId` (1:1) |
| `Transaction` | Cash flows (`INCOME`, `EXPENSE`, `TRANSFER_TO_PORTFOLIO`) | `userId`; `accountId`, optional `categoryId`, `importHash` |
| `PortfolioTrade` | BUY/SELL lots per symbol inside a brokerage account | `userId` + `accountId`; optional `assetId` |
| `FinancialAccount` | Legacy/manual wrappers (`REAL_ESTATE`, `CRYPTO`, `LIABILITY`, `BONDS`) | `userId`; `type` + unique `[userId, name]` |
| `Category` | Income/expense tree (`parentId`, `kind`) | `userId` |
| `BondHolding` | Treasury bond line on `BONDS` account | `accountId` |
| `Asset` | Global instrument catalog (symbol, type, currency) | Global; unique per `(symbol, exchange, source)` |
| `MarketPriceDaily` | Historical EOD closes per asset | `assetId` + `priceDate` + `source` |
| `AccountBalanceDaily` | Materialized daily balance snapshots per account | `accountId` + `date` |

## Account model

Managed accounts (phase 1: **BANK** + **BROKERAGE**) use `Account` with type-specific 1:1 extensions:

- **BANK** — balance from `BankAccountDetails.openingBalance` + INCOME − EXPENSE transactions.
- **BROKERAGE** — cash from `BrokerageAccountDetails.cashBalance` (maintained via transfers + trades); securities from open lots valued with `MarketPriceDaily`.

Daily history is stored in `AccountBalanceDaily` and recomputed via `backend/src/accountBalance.ts`.

Manual asset types (`REAL_ESTATE`, `CRYPTO`, `LIABILITY`, `BONDS`) remain on `FinancialAccount` until a later phase.

## Brokerage workflow

1. User creates `Account` with `type: BROKERAGE` (`POST /api/portfolios` alias).
2. Cash enters via `TRANSFER_TO_PORTFOLIO` transactions linked to the brokerage `accountId`.
3. Trades (`PortfolioTrade`) are recorded via `POST /api/portfolio` or broker CSV import.
4. `GET /api/portfolio?portfolioId=&currency=` aggregates trades per symbol (legacy alias; prefer `/api/accounts/:id`).

Valuation helpers: `backend/src/portfolioValuation.ts`, net worth: `backend/src/netWorth.ts`.

## Categories

- Hierarchical via `Category.parentId`.
- Transactions store denormalized `category` path string and optional `categoryId`.
- Stats charts roll up amounts to root category name.

## Data migration

- `npm run db:migrate-categories` (backend): backfill `categoryId` on transactions from legacy `category` strings; ensures „Niesklasyfikowane” nodes.
- Refactor migration `20260605140000_refactor_accounts_assets`: `FinancialAccount` (BANK) + `InvestmentPortfolio` → `Account`; prices → `Asset` + `MarketPriceDaily`.

## Transaction types

- `INCOME` / `EXPENSE` — cashflow on a `BANK` account (`accountId`).
- `TRANSFER_TO_PORTFOLIO` — increases brokerage cash; `accountId` points to the brokerage account.

## Market data

- Global `Asset` rows keyed by `symbol`, optional `exchange`, `source`.
- Daily closes in `MarketPriceDaily`; staleness in `marketData.ts`.
- Manual refresh: `POST /api/market-data/refresh` (incremental backfill per symbol).

## Related docs

- [api.md](api.md) — HTTP surface
- [architecture.md](architecture.md) — auth and FX flow
