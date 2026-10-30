---
id: MVP-021
status: done
domain: market-fx
title: STOCK/ETF market data sync
---

# STOCK/ETF market data sync

## Summary

Twelve Data catalog (`/stocks` + `/etfs`) upserted into `Instrument`; EOD closes into `InstrumentValuation` for watchlist symbols via CLI and soft-fail on-add fetch.

## User value

Search stocks/ETFs locally without burning credits per keystroke; favorites get last close when the plan covers the symbol.

## Surfaces

| Kind | Location |
|------|----------|
| Domain | `backend/src/domain/{instruments,instrumentValuations,marketData,twelveDataClient}.ts` |
| CLI | `npm run market:sync-catalog`, `npm run market:sync-quotes` |
| How-to | [docs/how-to/markets-watchlist.md](../../../docs/how-to/markets-watchlist.md) |

## Acceptance

- [x] Sync upserts Instrument from Twelve Data lists
- [x] Sync upserts InstrumentValuation source `twelve_data` for watchlisted symbols
- [x] HTTP list watchlist does not call Twelve Data

## Implementation notes

- Env: `TWELVE_DATA_API_KEY` (optional base URL)
- Holdings / lots / net-worth from positions remain out of scope (see FR-039 for UI favorites)

## Out of scope / follow-ups

- Holdings, quantity, crypto EOD (FR-031), live quotes
