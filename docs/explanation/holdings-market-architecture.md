---
diataxis: explanation
use_when: Understanding holdings, lots, trades, MTM, or market-data sync; FR-007/014/MVP-012
audience: both
related_docs:
  - docs/explanation/architecture.md
  - docs/reference/domain.md
  - docs/meta/code-map.md
  - docs/how-to/brokerage-asset-trades.md
  - docs/how-to/markets-watchlist.md
  - mvp/CHECKLIST.md
related_code:
  - backend/prisma/schema.prisma
  - backend/src/domain/assetTrades.ts
  - backend/src/domain/lots.ts
  - backend/src/domain/holdings.ts
  - backend/src/domain/portfolioValuation.ts
  - backend/src/domain/instrumentValuations.ts
  - backend/src/routes/assetTradesRoutes.ts
  - backend/src/domain/fx.ts
---

# Holdings and market-data architecture

Hub: [docs/README.md](../README.md). How-to: [brokerage-asset-trades.md](../how-to/brokerage-asset-trades.md). Product backlog: [mvp/CHECKLIST.md](../../mvp/CHECKLIST.md).

## Shipped (v1)

- **Catalog / market:** `Instrument`, `InstrumentValuation`, user `WatchlistItem`; Yahoo EOD (quotes/history/gaps); Twelve Data catalog + curated allowlist.
- **Portfolio:** `Holding`, `Lot`, `LotClose`, `AssetTrade` on account types `BROKERAGE` / `IKE` / `IKZE`.
- **Writes:** FIFO BUY/SELL via `domain/assetTrades.ts` + `lots.ts` inside `prisma.$transaction`; cash legs `ASSET_BUY` / `ASSET_SELL` (`assetTradeId`); period cashflow stats ignore those types.
- **Reads:** Holdings MTM + account equity (`cash + holdingsValue`); net worth / history include holdings MTM by account-type bucket; balance-history series: cash / holdings / equity.
- **HTTP:** `GET/POST/DELETE …/asset-trades`, `GET …/holdings` in [`assetTradesRoutes.ts`](../../backend/src/routes/assetTradesRoutes.ts). UI: `BrokerageHoldingsPanel` on `/accounts/:id`.

Currency rule (v1): instrument quote currency must equal account currency (no cross-currency trades).

## Schema (as built)

| Model | Ownership | Role |
|-------|-----------|------|
| `Instrument` | Shared catalog | Symbol, name, asset class, quote currency, provider keys |
| `InstrumentValuation` | Shared | EOD close per `(instrumentId, asOfDate, source)` |
| `Holding` | Via `Account` | Open qty per account+instrument (`onDelete: Cascade` with account) |
| `Lot` / `LotClose` | Via `Holding` | FIFO open lots and partial closes |
| `AssetTrade` | Via `Account` | BUY/SELL; `onDelete: Restrict` on account — DELETE account → `409` until trades reversed |

Mark-to-market never stores prices on `Holding`; it reads latest collapsed close × quantity in `portfolioValuation.ts` via SQL latest-per-id (`getLatestValuationsByInstrumentIds`). Month replay for balance / net-worth history loads a bounded as-of window (+ prior-close carry-forward) through `loadValuationsForAsOfReplay`.

## Domain module layout

| Path | Responsibility |
|------|----------------|
| `domain/instruments.ts` | Catalog helpers, search scopes |
| `domain/instrumentValuations.ts` | Upsert closes, source priority, SQL latest-per-id, as-of replay loader |
| `domain/holdings.ts` | Resolve holding, sync qty, account-type gate |
| `domain/lots.ts` | Open lot / FIFO close / reverse |
| `domain/assetTrades.ts` | Parse + apply/reverse trade |
| `domain/portfolioValuation.ts` | Batched MTM (SQL latest), balance-history holdings replay |
| `domain/marketData.ts` / `yahooHistory.ts` / … | Provider sync (prefer CLIs + gap scheduler; history GET may still backfill; soft-fill deduped in-process) |
| `routes/assetTradesRoutes.ts` | Auth + owned account + serialize |
| `frontend/src/api/holdingsApi.ts` / `assetTradesApi.ts` | Client contracts |

## Tenancy

- Resolve owned `Account` (`userId`) before any holding/trade write; foreign ids → `404`.
- Instruments/valuations are global; attaching a trade still requires an owned brokerage-like account.
- HTTP IDOR coverage: `backend/test/assetTrades.http.test.ts`.

## Net worth

`GET /api/statistics/net-worth` (and history) convert each owned account’s **cash + holdings MTM** into the reporting currency via NBP, then map into buckets by account type (`BROKERAGE|IKE|IKZE` → `stock`, etc.). Aggregation stays in `domain/netWorth*.ts` — not in the SPA.

## Still out of scope / next

- Full `/portfolio` page and bucket filters (FR-008)
- CRYPTO / precious-metal / treasury asset trades
- Cross-currency trades and holdings FX inside MTM
- Corporate actions, tax lots UI, broker CSV import
- React Query / global fetch cache

## Related

- [architecture.md](architecture.md) — request flow
- [domain.md](../reference/domain.md) — Prisma models including Holding / AssetTrade
- [markets-watchlist.md](../how-to/markets-watchlist.md) — catalog and EOD
- [mvp/features/holdings-trades/](../../mvp/features/holdings-trades/) — backlog briefs
