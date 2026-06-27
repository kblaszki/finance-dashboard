# API catalog

Implementation: [`backend/src/routes/`](../backend/src/routes/) (wired in [`backend/src/app.ts`](../backend/src/app.ts)). Auth: `requireAuth` = Bearer JWT unless noted.

**Tenancy:** Account, transaction, and holding endpoints are scoped to the authenticated user. Instrument list/create and instrument valuations are a **shared global catalog** (any authenticated user can read/write); valuation recompute only affects the caller's brokerage accounts that hold the instrument.

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | `email`, `username`, `password` — returns 403 when `ALLOW_REGISTER=false` |
| POST | `/api/auth/login` | No | `email`, `password` |
| GET | `/api/auth/me` | Yes | `{ id, email, username }` |
| GET | `/api/auth/config` | No | `{ allowRegister }` — frontend uses this to hide `/register` |

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | `{ ok, db }` — liveness + SQLite connectivity |

## Accounts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts` | Yes | List user accounts |
| POST | `/api/accounts` | Yes | Create account |
| GET | `/api/accounts/:id` | Yes | Account detail |
| PUT | `/api/accounts/:id` | Yes | Update name/description |
| POST | `/api/accounts/:id/revalue` | Yes | MANUAL only — `{ value, valuationDate? }` updates estimate and chart |
| DELETE | `/api/accounts/:id` | Yes | Delete account |
| GET | `/api/accounts/:id/valuations` | Yes | `AccountValuationDaily`; `from`, `to` |

## Transactions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transactions` | Yes | List; `accountId`, `from`, `to` |
| POST | `/api/transactions` | Yes | Create; sets `balanceAfter`. Types: `INCOME`, `EXPENSE`, `TRANSFER_IN`, `TRANSFER_OUT`, `DIVIDEND` (brokerage only), `INTEREST` (bank/brokerage) |
| PUT | `/api/transactions/:id` | Yes | Update; recalculates balances |
| DELETE | `/api/transactions/:id` | Yes | Delete; recalculates balances |

## Instruments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/instruments` | Yes | Search; `q` |
| POST | `/api/instruments` | Yes | Create manual instrument |
| GET | `/api/instruments/:id/valuations` | Yes | Price history |
| POST | `/api/instruments/:id/valuations` | Yes | Add manual valuation |

## Import

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/import/broker-trades` | Yes | `?accountId=&broker=xtb&dryRun=true`; body `{ csv, filename? }` — preview or commit XTB CSV |

## Holdings (brokerage)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts/:accountId/holdings` | Yes | Open/closed holdings with metrics (`{ open, closed }`) |
| POST | `/api/accounts/:accountId/holdings` | Yes | Find-or-create holding for `instrumentId` |
| GET | `/api/holdings/:holdingId` | Yes | Single holding summary |
| GET | `/api/holdings/:holdingId/lots` | Yes | Trade history for holding |
| POST | `/api/holdings/:holdingId/lots` | Yes | BUY/SELL lot |
| POST | `/api/holdings/:holdingId/split` | Yes | Stock split — `{ ratio, effectiveDate }` scales lot quantities; per-share cost divides |
| DELETE | `/api/holding-lots/:id` | Yes | Delete lot; syncs holding quantity |
| GET | `/api/accounts/:accountId/holdings/:instrumentId/valuations` | Yes | Position value history |

## Stats

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stats/net-worth` | Yes | Net worth by account type; `currency` query converts each account value from its native currency via NBP rates (PLN base) |
| GET | `/api/stats/cashflow` | Yes | Period income/expense/net; `from`, `to`, optional `currency` converts transaction amounts from native account currency |
| GET | `/api/stats/expenses-by-category` | Yes | Expense breakdown by category string; optional `currency` converts amounts |
| GET | `/api/stats/income-by-category` | Yes | Income breakdown by category string; optional `currency` converts amounts |
| GET | `/api/stats/portfolio-summary` | Yes | Brokerage KPIs; `from`, `to`, `currency` |
| GET | `/api/stats/portfolio-history` | Yes | Aggregated brokerage value series; `from`, `to`, `currency` |
| GET | `/api/stats/benchmark-comparison` | Yes | Portfolio vs benchmark return; `from`, `to`, `currency`, `benchmark=WIG\|SP500` |
| GET | `/api/stats/tax-report` | Yes | PL tax year summary; `year`, `currency` |
| GET | `/api/stats/tax-report/export` | Yes | CSV of sales; `year`, `format=csv`, `currency` |

## Market data

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/market-data/status` | Yes | Last sync time, held instrument count, stale count |
| POST | `/api/market-data/sync` | Yes | Fetch EOD prices for held STOCK/ETF; body `{ backfillDays? }` |
