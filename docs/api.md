# API catalog

Implementation: [`backend/src/routes/`](../backend/src/routes/) (wired in [`backend/src/app.ts`](../backend/src/app.ts)). Auth: `requireAuth` = Bearer JWT unless noted.

**Tenancy:** Account, transaction, and holding endpoints are scoped to the authenticated user. Instrument list/create and instrument valuations are a **shared global catalog** (any authenticated user can read/write); valuation recompute only affects the caller's brokerage accounts that hold the instrument.

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | `email`, `username`, `password` — returns 403 when `ALLOW_REGISTER=false` |
| POST | `/api/auth/login` | No | `login` or `email` + `password` — username login supported (case-insensitive) |
| GET | `/api/auth/me` | Yes | `{ id, email, username }` |
| PATCH | `/api/auth/profile` | Yes | `{ username }` |
| PATCH | `/api/auth/password` | Yes | `{ currentPassword, newPassword }` |
| PATCH | `/api/auth/email` | Yes | `{ email, currentPassword }` |
| GET | `/api/auth/config` | No | `{ allowRegister }` — frontend uses this to hide `/register` |

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | `{ ok, db }` — liveness + SQLite connectivity |

## Accounts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts` | Yes | List user accounts; each row includes `totalBalance` (DATA-010 latest valuation or `cashBalance`) |
| POST | `/api/accounts` | Yes | Create account |
| GET | `/api/accounts/:id` | Yes | Account detail |
| GET | `/api/accounts/:id/stats` | Yes | YTD cashflow, YoY balance change, brokerage cash/securities split; optional `currency` |
| PUT | `/api/accounts/:id` | Yes | Update name/description; `metalGrams` on PRECIOUS_METAL (FR-032) |
| POST | `/api/accounts/:id/revalue` | Yes | MANUAL only — `{ value, valuationDate? }` updates estimate and chart |
| DELETE | `/api/accounts/:id` | Yes | Delete account |
| GET | `/api/accounts/:id/valuations` | Yes | `AccountValuationDaily`; `from`, `to` |

## Transactions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transactions` | Yes | List; `accountId`, `from`, `to`; includes `categoryId`, `splits` |
| POST | `/api/transactions` | Yes | Create; sets `balanceAfter`. Types: `INCOME`, `EXPENSE`, `TRANSFER_IN`, `TRANSFER_OUT`, `DIVIDEND` (brokerage only), `INTEREST` (bank/brokerage). Optional `categoryId` or `splits[]` (`{ categoryId, amount }`) for FR-018 |
| PUT | `/api/transactions/:id` | Yes | Update; recalculates balances; `categoryId` / `splits` |
| DELETE | `/api/transactions/:id` | Yes | Delete; recalculates balances |

## Categories (FR-015)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/categories` | Yes | List flat + tree; seeds defaults if empty |
| POST | `/api/categories` | Yes | Create `{ name, parentId?, sortOrder? }` |
| PUT | `/api/categories/:id` | Yes | Update name/parent/sort |
| DELETE | `/api/categories/:id` | Yes | Delete if unused |

## Budgets (FR-017)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/budgets` | Yes | List for month; `month` (YYYY-MM), optional `currency` — includes `spent`, `pctUsed` |
| PUT | `/api/budgets` | Yes | Upsert `{ categoryId, budgetMonth, amount, currency }` |
| DELETE | `/api/budgets/:id` | Yes | Remove budget row |

## Instruments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/instruments` | Yes | Search; `q` |
| GET | `/api/instruments/:id` | Yes | Instrument metadata (FR-009) |
| POST | `/api/instruments` | Yes | Create manual instrument; optional `pitZgCountry` (default `PL`) |
| GET | `/api/instruments/:id/valuations` | Yes | Price history |
| POST | `/api/instruments/:id/valuations` | Yes | Add manual valuation |

## Import

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/import/broker-trades` | Yes | `?accountId=&broker=xtb&dryRun=true`; body `{ csv, filename? }` — preview or commit XTB CSV |
| POST | `/api/import/bank-transactions` | Yes | FR-019 — `?accountId=&bank=mbank|generic&dryRun=true`; body `{ csv, filename? }` — bank `Transaction` import with duplicate skip via `import_rows` |

## Holdings (brokerage)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts/:accountId/holdings` | Yes | Open/closed holdings with metrics (`{ open, closed }`) |
| POST | `/api/accounts/:accountId/holdings` | Yes | Find-or-create holding for `instrumentId` |
| GET | `/api/accounts/:accountId/assets/:instrumentId` | Yes | FR-014 account-scoped holding summary by instrument |
| GET | `/api/holdings/:holdingId` | Yes | Single holding summary (`costBasis`, `unrealizedPnl`, `realizedPnl`) |
| GET | `/api/holdings/:holdingId/lots` | Yes | Trade history for holding |
| POST | `/api/holdings/:holdingId/lots` | Yes | BUY/SELL lot; optional `commission` |
| POST | `/api/holdings/:holdingId/split` | Yes | Stock split — `{ ratio, effectiveDate }` scales lot quantities; per-share cost divides |
| DELETE | `/api/holding-lots/:id` | Yes | Delete lot; syncs holding quantity |
| GET | `/api/accounts/:accountId/holdings/:instrumentId/valuations` | Yes | Position value history |

## Portfolio

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portfolio/positions` | Yes | Cross-account open positions; optional `accountId`, `instrumentType`, `assetBucket` filters |
| GET | `/api/asset-trades` | Yes | FR-007 buy/sell list; optional `from`, `to`, `accountId`, `instrumentId` |
| POST | `/api/asset-trades` | Yes | Create buy/sell; body `accountId`, `instrumentId`, `side`, `quantity`, `pricePerUnit` or `totalPrice`, `commission?`, `currency?`, `tradeDate`; triggers market sync on BUY when API key set |
| GET | `/api/internal-transfers` | Yes | FR-011 transfer list; optional `from`, `to`, `accountId` |
| GET | `/api/internal-transfers/fx-suggestion` | Yes | Suggest FX rate; `fromCurrency`, `toCurrency`, `fromAmount` |
| POST | `/api/internal-transfers` | Yes | Create paired transfer legs atomically |
| DELETE | `/api/internal-transfers/:groupId` | Yes | Delete transfer pair by `groupId` |

## Stats

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stats/net-worth` | Yes | Net worth with 5-bucket breakdown (FR-002); `currency`; returns `totalAssets`, `totalLiabilities`, `total` (net), `liabilities[]` (FR-029) |
| GET | `/api/stats/average-holding-return` | Yes | FR-001 value-weighted average holding return; optional `currency` |
| GET | `/api/stats/cashflow` | Yes | Period income/expense/net; `from`, `to`, optional `currency` converts transaction amounts from native account currency |
| GET | `/api/stats/cashflow-history` | Yes | FR-004 monthly income/expense/net series; `from`, `to`, optional `currency` |
| GET | `/api/stats/cashflow-rolling-12m` | Yes | FR-005 avg monthly income/expense/net over last 12 complete months; optional `currency` |
| GET | `/api/stats/expenses-by-category` | Yes | Expense breakdown by category string; optional `currency` converts amounts |
| GET | `/api/stats/income-by-category` | Yes | Income breakdown by category string; optional `currency` converts amounts |
| GET | `/api/stats/portfolio-summary` | Yes | Brokerage KPIs; `from`, `to`, `currency` |
| GET | `/api/stats/portfolio-history` | Yes | Aggregated brokerage value series; `from`, `to`, `currency` |
| GET | `/api/stats/benchmark-comparison` | Yes | Portfolio vs benchmark return; `from`, `to`, `currency`, `benchmark=WIG\|SP500` |
| GET | `/api/stats/tax-report` | Yes | PL tax year — PIT-38 FIFO (FR-022), Belka sections (FR-027), PIT/ZG helper (FR-028), derivative flag (FR-025), rental stub (FR-026); `year`, `currency` |
| GET | `/api/stats/tax-report/export` | Yes | CSV of sales; `year`, `format=csv`, `currency` |

## Income events (FR-024)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/income-events` | Yes | List; `from`, `to`, `accountId` |
| POST | `/api/income-events` | Yes | Create `{ accountId, eventType, amount, currency, date, taxType?, instrumentId?, withheldTax?, sourceCountry?, foreignTaxPaid?, description? }` |
| PUT | `/api/income-events/:id` | Yes | Update |
| DELETE | `/api/income-events/:id` | Yes | Delete |

## Liabilities (FR-029)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/liabilities` | Yes | List user liabilities |
| POST | `/api/liabilities` | Yes | Create `{ name, liabilityType, balance, currency, accountId? }` |
| PUT | `/api/liabilities/:id` | Yes | Update |
| DELETE | `/api/liabilities/:id` | Yes | Delete |

## Property cash flows (FR-030)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/property-cash-flows` | Yes | List; `accountId`, `from`, `to` |
| POST | `/api/property-cash-flows` | Yes | Create on REAL_ESTATE account — `{ accountId, flowType, amount, currency, date, description? }` |
| PUT | `/api/property-cash-flows/:id` | Yes | Update |
| DELETE | `/api/property-cash-flows/:id` | Yes | Delete |

## Tax wrappers (FR-039, DATA-018/023)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tax-wrapper-withdrawals` | Yes | List; `accountId`, `from`, `to` |
| POST | `/api/tax-wrapper-withdrawals` | Yes | Create — `{ accountId, amount, currency, withdrawnOn, withdrawalType, includeInPit38?, description? }` |
| DELETE | `/api/tax-wrapper-withdrawals/:id` | Yes | Delete |
| GET | `/api/ikze-contributions` | Yes | List; `accountId`, `taxYear` |
| POST | `/api/ikze-contributions` | Yes | Create on IKZE account — `{ accountId, taxYear, amount, currency, contributedOn }` |
| DELETE | `/api/ikze-contributions/:id` | Yes | Delete |

`PUT /api/accounts/:id` accepts `taxWrapperType` (`standard`, `ike`, `ikze`, `ppk`) on brokerage accounts.

## Position transfers (FR-041, DATA-020)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/position-transfers` | Yes | List; `accountId`, `from`, `to` |
| POST | `/api/position-transfers` | Yes | Move open lots — `{ fromAccountId, toAccountId, instrumentId, quantity, transferDate }` |

## Corporate actions (FR-040, DATA-019)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/corporate-actions` | Yes | List; `accountId`, `from`, `to` |
| POST | `/api/corporate-actions` | Yes | Record action; `stock_split` / `reverse_split` apply split — `{ accountId, instrumentId, actionType, actionDate, ratio?, holdingId?, notes? }` |

`POST /api/holdings/:holdingId/lots` accepts optional `settlementDate` (FR-007).

## Market data

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/market-data/status` | Yes | Last sync time, held instrument count, stale count |
| POST | `/api/market-data/sync` | Yes | Fetch EOD prices for ever-bought STOCK/ETF (default backfill since 2020) + NBP FX history; body `{ backfillDays? }` |
