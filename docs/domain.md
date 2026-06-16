# Domain model

Source of truth: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma). Planning docs: [`plans/baza_danych/`](../plans/baza_danych/).

## Core entities

| Model | Purpose |
|-------|---------|
| `User` | `email`, `username`, `passwordHash` |
| `Account` | Unified account (`BANK`, `BROKERAGE`, `MANUAL`); `cashBalance`, `openingBalance`, `currency` |
| `Transaction` | Cash flows with `balanceAfter` snapshot |
| `Instrument` | Global instrument catalog (symbol, exchange, type) |
| `HoldingLot` | BUY/SELL lots per account with `quantityAfter` |
| `InstrumentValuation` | Daily/manual price per instrument |
| `AccountValuationDaily` | Materialized account value snapshots |
| `HoldingValuationDaily` | Materialized position value per instrument |

## Account workflow

- **BANK** — transactions update `cashBalance` and `balanceAfter`; valuations backfilled for charts.
- **BROKERAGE** — cash via transactions; securities via `HoldingLot`; total value in `AccountValuationDaily`.
- **MANUAL** — manual instruments and valuations.

## Categories

`Transaction.category` is a plain string (no `Category` tree).

## Related docs

- [api.md](api.md) — REST surface
- [architecture.md](architecture.md) — auth and FX flow
