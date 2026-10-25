---
diataxis: explanation
use_when: Designing holdings, lots, trades, or market-data sync before implementing FR-007/014/MVP-021
audience: both
related_docs:
  - docs/explanation/architecture.md
  - docs/reference/domain.md
  - docs/meta/code-map.md
  - mvp/CHECKLIST.md
related_code:
  - backend/prisma/schema.prisma
  - backend/src/domain/fx.ts
  - backend/src/domain/accountTypes.ts
---

# Holdings and market-data architecture (spike)

Hub: [docs/README.md](../README.md). Product backlog: [mvp/CHECKLIST.md](../../mvp/CHECKLIST.md) (`holdings-trades`, `market-fx`). **Not shipped** — this page freezes layout and tenancy rules before schema migrations.

Cash sleeve (accounts, ledger, transfers, categories, tags, CSV import, period stats) stays the baseline. Holdings is a **new axis**: instruments + account-scoped positions + valuations, joined to net-worth later (FR-038).

## Goals of this spike

- Sketch Prisma models and `domain/` module boundaries without implementing UI or routes.
- Reuse cash-sleeve discipline: every user-owned row scoped by `userId` / owned `accountId`; foreign ids → `404` (not `403`).
- Keep money math and price conversion out of route handlers and the SPA (same rule as NBP FX today).
- Separate **catalog/market** data from **user portfolio** data so sync jobs never mix tenancy.

## Proposed schema (sketch)

Names are provisional; migrate only when an implementation plan starts.

| Model | Ownership | Role |
|-------|-----------|------|
| `Instrument` | Shared catalog (no `userId`) | Symbol, name, asset class (`STOCK` / `ETF` / `CRYPTO` / …), quote currency, optional external provider id |
| `InstrumentValuation` | Shared (FK → `Instrument`) | EOD (or manual) price for a UTC day; `source` (`twelve_data`, `manual`, …); unique `(instrumentId, asOfDate, source)` or supersede by policy |
| `Holding` | User via `Account` | Open position on one account for one instrument; quantity in instrument units; optional cost basis cache |
| `Lot` | User via `Holding` | FIFO (or average) lots for realized P&L (MVP-012); opened/closed qty, cost, commission |
| `AssetTrade` | User via `Account` (+ `Instrument`) | BUY/SELL with commission, trade date, optional `settlementDate` (FR-007); creates/adjusts lots |

**Relations (intent):**

- `Account` 1—* `Holding` (`onDelete: Cascade` or Restrict if trades exist — prefer Restrict + API `409` like transfers).
- `Holding` 1—* `Lot`; `AssetTrade` links to account + instrument and optionally to lots created.
- `Instrument` 1—* `InstrumentValuation` (global); sync CLIs write valuations only.
- Do **not** put prices on `Holding` permanently — mark-to-market reads latest valuation × quantity in domain code.

**Cash interaction:** Asset trades may later debit/credit `cashBalance` on the same account; treat that as an explicit domain transaction (cash leg + trade), not an orphan ledger row. Until then, cash and holdings can coexist without auto-linking.

## Domain module layout

Mirror cash sleeve thin routes + fat domain:

| Path (planned) | Responsibility |
|----------------|----------------|
| `backend/src/domain/instruments.ts` | Catalog CRUD helpers, symbol normalize, asset-class allow-list |
| `backend/src/domain/holdings.ts` | Owned holding resolve, quantity invariants, IDOR helpers |
| `backend/src/domain/lots.ts` / `fifo.ts` | Lot open/close, realized P&L |
| `backend/src/domain/assetTrades.ts` | Trade validation (commission, settlementDate), apply to lots |
| `backend/src/domain/marketData.ts` | Provider client + upsert valuations (MVP-021); no user context |
| `backend/src/domain/portfolioValuation.ts` | Holding × price → major units; FX via existing `fx.ts` / PLN pivot when FR-038 lands |
| `backend/src/routes/holdingsRoutes.ts` (etc.) | Auth + parse + call domain; soft caps for list/export when added |
| `frontend/src/api/holdingsApi.ts` / `instrumentsApi.ts` | Types matching serializers |

Keep **market sync** as scripts (`backend/src/scripts/syncMarketData.ts`) similar to `syncFxRates`, not inside request handlers.

## Tenancy / IDOR checklist (carry into first PR)

- Resolve `Account` with `{ id, userId }` before any holding/trade write.
- Holding and trade routes: foreign `accountId` / `holdingId` → `404`.
- Instruments catalog may be global; user mutations that attach an instrument must still verify the account is owned.
- HTTP tests: matching `*.http.test.ts` suite (do not revive a monolith) with foreign-user cases.

## Net-worth evolution

Today `GET /api/statistics/net-worth` sums `Account.cashBalance` by bucket only. After holdings:

1. Per-account holding value in account currency (quantity × last valuation in quote currency, FX if needed).
2. Add into existing buckets (`stock`, `crypto`, …) by instrument class / account type — product decision in FR-002/038 follow-ups.
3. Keep cash and holdings aggregation in `domain/`, not in `DashboardPage`.

## Explicitly out of scope for the first implementation plan

- Full `/portfolio` UI and bucket filters (FR-008) before holding CRUD works.
- Tax / corporate actions (FR-040) before lots exist.
- React Query / global cache.
- SQL `groupBy` for cash stats — still deferred (see [testing.md](../reference/testing.md)); holdings lists get soft caps first.

## Suggested implementation order (after this spike)

1. Schema migration: `Instrument` + `InstrumentValuation` + `Holding` (quantity only).
2. Domain + HTTP: list/create/delete holdings on owned accounts; IDOR tests.
3. `AssetTrade` + lots (FR-007 / MVP-012).
4. Market sync CLI (MVP-021) writing valuations.
5. Valuation in net-worth / portfolio UI; then FR-038 FX rollup.

## Related

- [architecture.md](architecture.md) — shipped request flow
- [domain.md](../reference/domain.md) — current Prisma models (no holdings yet)
- [mvp/features/holdings-trades/](../../mvp/features/holdings-trades/) — feature briefs
- [mvp/features/market-fx/stock-etf-market-sync.md](../../mvp/features/market-fx/stock-etf-market-sync.md)
