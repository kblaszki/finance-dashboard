---
id: MVP-021
status: done
domain: market-fx
title: STOCK/ETF market data sync
---

# STOCK/ETF market data sync

## Summary

Twelve Data EOD for mapped STOCK/ETF; status + cron CLI.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | Market sync + CLI |

## Acceptance

- [ ] Sync upserts InstrumentValuation source twelve_data

## Implementation notes

- Docs: docs/how-to/market-data-sync.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (when FR/NFR)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
