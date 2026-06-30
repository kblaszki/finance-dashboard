# Domain model

Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

## Core entities

| Model | Purpose |
|-------|---------|
| `User` | `email`, `username`, `passwordHash` |
| `Account` | Unified account (`BANK`, `BROKERAGE`, `CRYPTO`, `PRECIOUS_METAL`, `REAL_ESTATE`, `OTHER`, legacy `MANUAL`); `cashBalance`, `openingBalance`, `openingCashAsOf` (DATA-002), `currency` |
| `Transaction` | Cash flows with `balanceAfter` snapshot; types include `DIVIDEND` and `INTEREST` for corporate income |
| `Instrument` | Global instrument catalog (symbol, exchange, type) |
| `Holding` | Brokerage position per account + instrument; persisted `quantity` (current net shares) |
| `HoldingLot` | BUY/SELL trade ledger under a `Holding`; `quantityAfter` chain; `commission` (FR-007) |
| `InstrumentValuation` | Daily/manual price per instrument |
| `FxRateDaily` | Historical NBP FX legs (USD/PLN, EUR/PLN) since 2020 (FR-010, DATA-008) |
| `AccountValuationDaily` | Materialized account value snapshots |
| `HoldingValuationDaily` | Materialized position value per instrument |

## Brokerage holdings

- One `Holding` row per `(accountId, instrumentId)`; created on first trade.
- `Holding.quantity` is synced from the last lot's `quantityAfter` after every lot CRUD.
- Closed positions (`quantity = 0`) are retained for history and realized P&amp;L.
- `marketValue` and `realizedPnl` are computed at read time (not stored on `Holding`). Closed-position `realizedPnl` uses **FIFO** across lots (`fifoRealizedPnl.ts`).

## Instrument types

Allowed `Instrument.instrumentType` values: `STOCK`, `ETF`, `BOND`, `FUND`, `OTHER`.

| Type | Typical valuation source |
|------|-------------------------|
| STOCK, ETF | `twelve_data` (EOD sync) when exchange is mapped; else manual |
| BOND, FUND | `manual_nav` — user enters NAV/price from broker or fund manager |
| OTHER | manual |

Market sync (`POST /api/market-data/sync`) processes **STOCK** and **ETF** only; BOND/FUND are skipped without error.

## Global instrument catalog

- `Instrument` and `InstrumentValuation` rows are **shared** across all users (no `userId` on the model).
- Any authenticated user may search/create instruments and append manual valuations.
- `POST /api/instruments/:id/valuations` writes a global price row but **recomputes daily account snapshots only for the caller's accounts** that hold the instrument (`recomputeAccountsForInstrumentUser`).
- `POST /api/market-data/sync` still recomputes all affected accounts (system job).
- Designed for **single-user private** deployment; multi-tenant hosting requires a product decision (per-user catalog, admin-only writes, etc.). See [private-ops.md](private-ops.md).

## CSV import (XTB)

Brokerage accounts can import XTB exports via `POST /api/import/broker-trades`. Parsed rows become `HoldingLot` (trades) or `Transaction` (dividends, interest, transfers). `ImportBatch` / `ImportRow` store `externalHash` per account for idempotent re-upload.

## Corporate actions

| Event | Mechanism |
|-------|-----------|
| Dividend | `Transaction` type `DIVIDEND` credits brokerage cash (`category` typically `DIVIDEND`) |
| Bond interest | `Transaction` type `INTEREST` on bank or brokerage (`category` typically `INTEREST`) |
| Stock split | `POST /api/holdings/:holdingId/split` — multiplies all lot quantities and `quantityAfter` by `ratio`; `pricePerUnit` divides; `totalPrice` per lot unchanged |

Splits recompute account valuations from `effectiveDate`. Historical charts before the split may show pre-split per-share prices with post-split quantities unless market prices are adjusted manually.

## Tax reporting (PL)

Annual estimates via `GET /api/stats/tax-report` — FIFO realized gains on SELL lots in calendar year, dividend gross, Belka 19% on positive net gains. Details: [tax.md](tax.md).

## Account workflow

- **BANK** — transactions update `cashBalance` and `balanceAfter`; valuations backfilled for charts.
- **BROKERAGE** — cash via transactions; securities via `Holding` / `HoldingLot`; `AccountValuationDaily.cashValue` replays transactions **and** lot trade cash impact (BUY/SELL).
- **MANUAL** — tracked account value (`openingBalance` / `cashBalance`); no holdings. Revalue via `POST /api/accounts/:id/revalue` (creates internal `REVALUATION` ledger entry for chart step).

## Categories (FR-015, DATA-011)

User-scoped `Category` tree (`parentId`, `sortOrder`). Defaults seeded on register (`ensureDefaultCategories`). `Transaction.categoryId` optional FK; legacy `Transaction.category` string kept for dividends/interest and display fallback.

`TransactionSplit` rows (`transactionId`, `categoryId`, `amount`) enable split expenses; when present, stats breakdown uses splits instead of the parent category string.

## Budgets (FR-017, DATA-012)

`Budget` — per user, per `categoryId`, per calendar month (`budgetMonth`), `amount` + `currency`. Unique on `(userId, categoryId, budgetMonth)`.

## Income events (FR-024, DATA-015)

`IncomeEvent` — dividends, interest, coupons separate from trade lots. Fields: `eventType`, `taxType` (`belka`, `pit38`, `exempt`), optional `instrumentId`, `withheldTax`, `sourceCountry`, `foreignTaxPaid`. Tax reports prefer income events over duplicate `Transaction` rows.

`Instrument.pitZgCountry` — ISO country for PIT/ZG helper (FR-028); default `PL`.

## Related docs

- [api.md](api.md) — REST surface
- [architecture.md](architecture.md) — auth and FX flow
