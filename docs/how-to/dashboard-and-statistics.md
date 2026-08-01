---
diataxis: how-to
use_when: Use the dashboard, statistics, portfolio filters, or net-worth widgets
audience: both
related_docs:
  - docs/explanation/portfolio-stats.md
  - docs/how-to/liabilities.md
  - docs/how-to/market-data-sync.md
  - docs/how-to/budgets-and-categories.md
related_code:
  - frontend/src/pages/DashboardPage.tsx
  - frontend/src/pages/StatisticsPage.tsx
  - frontend/src/pages/PortfolioPage.tsx
  - backend/src/portfolioStats.ts
  - backend/src/netWorth.ts
---

# Dashboard and statistics

Hub: [docs/README.md](../README.md).

How to read the analytics surfaces. KPI formulas: [portfolio-stats.md](../explanation/portfolio-stats.md). Requirement IDs: [requirements.md](../reference/requirements.md).

## Period and currency

1. On `/dashboard` and `/statistics`, use `PeriodFilter` (presets or custom `from`/`to`).
2. Shell currency selector converts most KPIs/charts via NBP; **net worth on the dashboard is always PLN** (FR-038) with `fxRatesAsOf`.
3. Theme toggle is local-only (no API).

## Dashboard (`/dashboard`)

1. Check `MarketPricesStatus` — run sync if prices look stale ([market-data-sync.md](market-data-sync.md)).
2. **Net worth** — assets by bucket minus liabilities ([liabilities.md](liabilities.md)).
3. **Budget alerts** — categories over 80%/100% ([budgets-and-categories.md](budgets-and-categories.md)).
4. Toggle **Portfolio** vs **Budget** tab:
   - Portfolio: summary KPIs, history, allocation, average holding return, benchmark (WIG/SP500).
   - Budget: cashflow KPIs, income/expense charts by category.
5. Rolling 12-month averages and average return sit above the tabs.

## Statistics (`/statistics`)

1. Period KPIs: income / expense / net (internal transfers excluded from cashflow stats).
2. Cashflow history chart (FR-004).
3. Category breakdown table (FR-016).

## Portfolio page (`/portfolio`)

1. Cross-account open positions (FR-008).
2. Filter by account, instrument type, and **asset bucket** (`stock_market`, `crypto`, `precious_metal_other`, `real_estate` — see [portfolio-stats](../explanation/portfolio-stats.md#net-worth-and-asset-buckets)).
3. Drill into holding detail or `/assets/:id` price chart.

## When numbers look wrong

| Symptom | Check |
|---------|--------|
| Stale securities | Market sync / API key |
| Net worth ≠ sum of accounts | Liabilities, FX as-of, revalue/asset valuations |
| Empty benchmark | No valuation history in window; benchmark proxy instrument prices |
| Budget tab empty | No categorized expenses in period |

| Area | Path |
|------|------|
| UI | `DashboardPage`, `StatisticsPage`, `PortfolioPage` |
| APIs | `/api/stats/*`, `/api/portfolio/positions` |
| Docs | [portfolio-stats](../explanation/portfolio-stats.md), [requirements](../reference/requirements.md) |
