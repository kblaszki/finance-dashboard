---
id: FR-010
status: done
domain: market-fx
title: Historical NBP FX rates
---

# Historical NBP FX rates

## Summary

NBP table A mid rates for **EUR** and **USD** stored in global `FxRateDaily`, with conversion via PLN in `domain/fx.ts`. Sync is CLI-driven (`npm run fx:sync`).

## User value

Backend foundation for valuations and future PLN net-worth rollup (FR-038). No dashboard UI in this slice.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | `FxRateDaily` + `npm run fx:sync` + `domain/fx.ts` |
| Docs | [docs/reference/scripts.md](../../../docs/reference/scripts.md), [domain.md](../../../docs/reference/domain.md) |

## Acceptance

- [x] FX conversion via `fx.ts` (`convertMajor`, PLN pivot)
- [x] `FxRateDaily` unique on `(rateDate, currency)`
- [x] CLI sync from NBP for EUR/USD (`--days` / `--from`+`--to`)
- [x] As-of lookup uses latest `rateDate <= asOf`

## Implementation notes

- Domain: `backend/src/domain/fx.ts`, `fxRates.ts`, `nbpClient.ts`
- CLI: `backend/src/scripts/syncFxRates.ts` → `npm run fx:sync` (requires `npm run build`)
- Optional env: `NBP_API_BASE` (default `https://api.nbp.pl/api`)
- Whitelist: PLN (pivot only), EUR, USD — extend later on request
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- FR-038 Dashboard PLN net-worth rollup
- NBP suggestion on `/transfers`
- Additional NBP currencies (GBP, …)
- Auto-sync on API startup
