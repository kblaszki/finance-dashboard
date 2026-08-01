---
diataxis: explanation
use_when: Understand dashboard portfolio KPIs, history, and benchmarks
audience: both
related_docs:
  - docs/reference/api.md
  - docs/explanation/tax-pl.md
  - docs/how-to/accounts-and-holdings.md
  - docs/how-to/dashboard-and-statistics.md
  - docs/how-to/liabilities.md
related_code:
  - backend/src/portfolioStats.ts
  - backend/src/fifoRealizedPnl.ts
  - backend/src/netWorth.ts
  - backend/src/portfolio.ts
  - backend/src/benchmarks.ts
  - backend/src/stats.ts
---
# Portfolio statistics

Hub: [docs/README.md](../README.md).

Dashboard and statistics screens aggregate values from account snapshots and open holdings. Core math lives in `backend/src/portfolioStats.ts` (wired through `statsRoutes` / `stats.ts`). This page explains **what the numbers mean**, not how to call every endpoint — see [api.md](../reference/api.md) Stats section. UX steps: [dashboard-and-statistics.md](../how-to/dashboard-and-statistics.md).

## Summary KPIs

`computePortfolioSummary` (approx. `GET /api/stats/portfolio-summary`) returns display-currency totals:

- **Cash / securities / total** from latest valuations and open holdings.
- **Unrealized P&amp;L** on open positions (mark-to-market vs cost).
- **Realized P&amp;L (closed)** from FIFO across lots (`fifoRealizedPnl.ts`) — same FIFO idea as tax, but for portfolio KPIs rather than calendar-year PIT-38. Detail: [fifo-cost-basis.md](fifo-cost-basis.md). Tax assumptions: [tax-pl.md](tax-pl.md).
- **Simple money-weighted return** (`computeSimpleReturnPct`): `(end − start − netContributions) / (start + netContributions)` — **not** time-weighted return (TWR).
- **Allocation** rows by instrument/account type buckets.

Value-weighted average holding return (`computeValueWeightedAverageReturnPct`, dashboard `AverageReturnKpi`): mean of per-holding `(current − cost) / cost` weighted by current value (FR-001).

## History series

`computePortfolioHistory` / `buildPortfolioHistoryPoints` build a daily series from `AccountValuationDaily` (and related cash/securities splits) for charts (`PortfolioHistoryChart`). Missing days are filled from last known valuation where needed.

## Benchmarks

`computeBenchmarkComparison` compares portfolio simple return over `[from, to]` to a benchmark series (`WIG` \| `SP500` via `benchmarks.ts`). Both sides use the same window and display currency; null returns when the base is non-positive.

Proxies (not full index constituents):

| Id | Label | Instrument used | Exchange / currency |
|----|-------|-----------------|---------------------|
| `WIG` | WIG (proxy: WIG20) | `WIG20` | GPW / PLN |
| `SP500` | S&amp;P 500 (proxy: SPY) | `SPY` | NYSE / USD |

Prices come from the shared `InstrumentValuation` catalog (market sync or manual). If the proxy symbol has no history in the window, comparison returns nulls.

## Net worth and asset buckets

`computeNetWorth` / `GET /api/stats/net-worth` (FR-002):

1. Build **asset** totals into `NET_WORTH_BUCKETS`: `cash`, `stock_market`, `crypto`, `precious_metal_other`, `real_estate`.
2. Subtract liabilities ([liabilities.md](../how-to/liabilities.md)).
3. `total` = `totalAssets − totalLiabilities`. Dashboard may force PLN + `fxRatesAsOf` (FR-038).

### How assets enter buckets (`aggregateNetWorthBuckets`)

| Source | Bucket rule |
|--------|-------------|
| Cash on BANK / BROKERAGE / CRYPTO / PRECIOUS_METAL | `cash` ← `cashBalance` (FX-converted) |
| Open holdings (portfolio positions) | Via `inferAssetBucket(accountType, instrumentType)` below |
| MANUAL / REAL_ESTATE / OTHER (revalue types) | Residual account total after holdings → `real_estate` |

### `inferAssetBucket` (portfolio filters + holdings contribution)

From `portfolio.ts`:

| Condition | Bucket |
|-----------|--------|
| `instrumentType === CRYPTO` (legacy rows) | `crypto` |
| Instrument in GOLD / SILVER / METAL / PRECIOUS_METAL | `precious_metal_other` |
| `accountType === MANUAL` | `real_estate` |
| Otherwise (typical STOCK/ETF on brokerage) | `stock_market` |

CRYPTO **accounts** also contribute cash to `cash` and crypto holdings via instrument/account paths. Account-type capability matrix: [domain.md](../reference/domain.md#account-workflow).

## Related

- UX: [dashboard-and-statistics.md](../how-to/dashboard-and-statistics.md)
- Holdings: [accounts-and-holdings.md](../how-to/accounts-and-holdings.md)
- FIFO detail: [fifo-cost-basis.md](fifo-cost-basis.md)
- Code map: [code-map.md](../meta/code-map.md) Portfolio stats / Net worth rows
- Architecture FX: [architecture.md](architecture.md)
