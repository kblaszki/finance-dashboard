---
diataxis: explanation
use_when: Understand dashboard portfolio KPIs, history, and benchmarks
audience: both
related_docs:
  - docs/reference/api.md
  - docs/explanation/tax-pl.md
  - docs/how-to/accounts-and-holdings.md
related_code:
  - backend/src/portfolioStats.ts
  - backend/src/fifoRealizedPnl.ts
  - backend/src/netWorth.ts
  - backend/src/stats.ts
---

# Portfolio statistics

Hub: [docs/README.md](../README.md).

Dashboard and statistics screens aggregate values from account snapshots and open holdings. Core math lives in `backend/src/portfolioStats.ts` (wired through `statsRoutes` / `stats.ts`). This page explains **what the numbers mean**, not how to call every endpoint — see [api.md](../reference/api.md) Stats section.

## Summary KPIs

`computePortfolioSummary` (approx. `GET /api/stats/portfolio-summary`) returns display-currency totals:

- **Cash / securities / total** from latest valuations and open holdings.
- **Unrealized P&amp;L** on open positions (mark-to-market vs cost).
- **Realized P&amp;L (closed)** from FIFO across lots (`fifoRealizedPnl.ts`) — same FIFO idea as tax, but for portfolio KPIs rather than calendar-year PIT-38. Tax assumptions: [tax-pl.md](tax-pl.md).
- **Simple money-weighted return** (`computeSimpleReturnPct`): `(end − start − netContributions) / (start + netContributions)` — **not** time-weighted return (TWR).
- **Allocation** rows by instrument/account type buckets.

Value-weighted average holding return (`computeValueWeightedAverageReturnPct`, dashboard `AverageReturnKpi`): mean of per-holding `(current − cost) / cost` weighted by current value (FR-001).

## History series

`computePortfolioHistory` / `buildPortfolioHistoryPoints` build a daily series from `AccountValuationDaily` (and related cash/securities splits) for charts (`PortfolioHistoryChart`). Missing days are filled from last known valuation where needed.

## Benchmarks

`computeBenchmarkComparison` compares portfolio simple return over `[from, to]` to a benchmark series (`WIG` \| `SP500` via `benchmarks.ts`). Both sides use the same window and display currency; null returns when the base is non-positive.

## Net worth

Separate from brokerage KPIs: `netWorth.ts` / `GET /api/stats/net-worth` rolls assets into buckets (`cash`, `stock_market`, `crypto`, `precious_metal_other`, `real_estate`) minus liabilities. Dashboard PLN rollup may include `consolidatedCurrency` / `fxRatesAsOf`.

## Related

- Day-to-day holdings: [accounts-and-holdings.md](../how-to/accounts-and-holdings.md)
- Code map: [code-map.md](../meta/code-map.md) Portfolio stats / Net worth rows
- Architecture FX: [architecture.md](architecture.md)
