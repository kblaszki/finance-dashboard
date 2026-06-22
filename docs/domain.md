# Domain model

Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma). Planning docs: [`plans/baza_danych/`](../plans/baza_danych/).

## Core entities

| Model | Purpose |
|-------|---------|
| `User` | `email`, `username`, `passwordHash` |
| `Account` | Unified account (`BANK`, `BROKERAGE`, `MANUAL`); `cashBalance`, `openingBalance`, `currency` |
| `Transaction` | Cash flows with `balanceAfter` snapshot |
| `Instrument` | Global instrument catalog (symbol, exchange, type) |
| `Holding` | Brokerage position per account + instrument; persisted `quantity` (current net shares) |
| `HoldingLot` | BUY/SELL trade ledger under a `Holding`; `quantityAfter` chain per holding |
| `InstrumentValuation` | Daily/manual price per instrument |
| `AccountValuationDaily` | Materialized account value snapshots |
| `HoldingValuationDaily` | Materialized position value per instrument |

## Brokerage holdings

- One `Holding` row per `(accountId, instrumentId)`; created on first trade.
- `Holding.quantity` is synced from the last lot's `quantityAfter` after every lot CRUD.
- Closed positions (`quantity = 0`) are retained for history and realized P&amp;L.
- `marketValue` and `realizedPnl` are computed at read time (not stored on `Holding`).

## Instrument types

Allowed `Instrument.instrumentType` values: `STOCK`, `ETF`, `BOND`, `FUND`, `OTHER`.

| Type | Typical valuation source |
|------|-------------------------|
| STOCK, ETF | `twelve_data` (EOD sync) when exchange is mapped; else manual |
| BOND, FUND | `manual_nav` — user enters NAV/price from broker or fund manager |
| OTHER | manual |

Market sync (`POST /api/market-data/sync`) processes **STOCK** and **ETF** only; BOND/FUND are skipped without error.

## Account workflow

- **BANK** — transactions update `cashBalance` and `balanceAfter`; valuations backfilled for charts.
- **BROKERAGE** — cash via transactions; securities via `Holding` / `HoldingLot`; `AccountValuationDaily.cashValue` replays transactions **and** lot trade cash impact (BUY/SELL).
- **MANUAL** — tracked account value (`openingBalance` / `cashBalance`); no holdings. Revalue via `POST /api/accounts/:id/revalue` (creates internal `REVALUATION` ledger entry for chart step).

## Categories

`Transaction.category` is a plain string (no `Category` tree).

## Related docs

- [api.md](api.md) — REST surface
- [architecture.md](architecture.md) — auth and FX flow
