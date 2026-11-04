---
diataxis: reference
use_when: Look up Prisma models
audience: both
related_code:
  - backend/prisma/schema.prisma
---

# Domain reference

Hub: [docs/README.md](../README.md).

## User

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| email | String | Unique |
| username | String | Unique display name |
| usernameKey | String | Unique lowercase key for login |
| passwordHash | String | bcrypt |
| tokenVersion | Int | Default 0; incremented when the password changes |
| createdAt | DateTime | Default now |
| accounts | Account[] | Owned accounts (`onDelete: Cascade`) |
| categories | Category[] | Owned category tree (`onDelete: Cascade`) |
| tags | Tag[] | Owned flat tags (`onDelete: Cascade`) |
| cashTransfers | CashTransfer[] | Owned internal transfers (`onDelete: Cascade`) |
| csvImportPresets | CsvImportPreset[] | Saved CSV column maps (`onDelete: Cascade`) |
| importBatches | ImportBatch[] | Cash CSV import audit rows (`onDelete: Cascade`) |
| categoryDescriptionRules | CategoryDescriptionRule[] | Import description → category rules (`onDelete: Cascade`) |
| watchlistItems | WatchlistItem[] | Markets favorites (`onDelete: Cascade`) |

## Category

User-scoped nested label (`parentId` self-relation). Each row has a fixed `ledgerType` (`INCOME` | `EXPENSE` | `TRANSFER`) inherited from its parent (roots set it on create). Reparent across types is rejected. Default seed creates flat roots (Salary, Food, …, Internal transfer) with `ledgerType` — no Income/Expense wrapper categories. `TRANSFER` categories tag internal cash transfers (shared by both ledger legs).

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| userId | Int | FK → User |
| name | String | Display name (roots may be renamed) |
| nameKey | String | Unique per user with the parent: `{parentId or 0}:{lowercase name}` |
| ledgerType | String | `INCOME`, `EXPENSE`, or `TRANSFER`; immutable after create |
| parentId | Int? | FK → Category (`onDelete: Restrict`); null = root |
| createdAt | DateTime | Default now |
| descriptionRules | CategoryDescriptionRule[] | Rules pointing at this category (`onDelete: Cascade`) |

Indexes: `[userId]`, `[parentId]`, `[userId, ledgerType]`, unique `[userId, nameKey]`. Domain: `backend/src/domain/categories.ts`. Register / `create-user` leave the tree empty; demo seed (`db:seed`) installs sample roots.

## CategoryDescriptionRule

User-scoped import suggestion: if a normalized description **contains** `pattern`, suggest `categoryId` (INCOME/EXPENSE). Longest matching pattern wins. Confirming a mapped description on import upserts an exact-pattern rule. Domain: `backend/src/domain/categoryDescriptionSuggest.ts`.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK |
| userId | Int | FK → User (`onDelete: Cascade`) |
| pattern | String | Normalized substring (≤ 120) |
| patternKey | String | Same as pattern for uniqueness |
| ledgerType | String | `INCOME` \| `EXPENSE` |
| categoryId | Int | FK → Category (`onDelete: Cascade`) |
| createdAt | DateTime | Default now |
| updatedAt | DateTime | `@updatedAt` |

Indexes: `[userId, ledgerType]`, `[categoryId]`, unique `[userId, ledgerType, patternKey]`.

## Account

User-scoped financial account. Create accepts allow-listed types; `accountType` is a validated string (not a Prisma enum).

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| userId | Int | FK → User |
| accountType | String | `BANK`, `BROKERAGE`, `CRYPTO`, `PRECIOUS_METAL`, `REAL_ESTATE`, `CREDIT_CARD`, `IKE`, `IKZE`, `TREASURY_BONDS`, `OTHER`, `MANUAL` (omit/blank → `BANK`). `CREDIT_CARD` uses signed `cashBalance` (≤ 0 = debt). `BROKERAGE` / `IKE` / `IKZE` support asset trades + holdings MTM. `TREASURY_BONDS` supports `BondPosition` (retail SP); other types remain cash-only for trades. |
| name | String | Unique per user (`@@unique([userId, name])`) |
| currency | String | FX whitelist only: `PLN`, `EUR`, or `USD` (stored uppercase). Create/PATCH reject other codes |
| cashBalance | Int | Working cash in minor units (cents). API JSON uses major units |
| openingBalance | Int | Opening cash seed in minor units (default 0) |
| openingCashAsOf | DateTime? | Optional opening date. Effective opening for balance / net-worth history: `openingCashAsOf ?? oldest ledger occurredAt ?? createdAt` (balance is 0 before that instant) |
| description | String? | Optional note |
| createdAt | DateTime | Default now |
| updatedAt | DateTime | `@updatedAt` |

Indexes: `[userId, accountType]`. API responses expose `cashBalance`, `holdingsValue` (equity MTM **or** treasury bond gross for `TREASURY_BONDS`), and `totalEquity` (= cash + holdingsValue in account currency); `totalBalance` remains an alias of cash for older clients. Allow-list: `backend/src/domain/accountTypes.ts`. Relations: `cashTransactions` → `CashTransaction[]` (`onDelete: Cascade`); `transfersFrom` / `transfersTo` → `CashTransfer[]` (`onDelete: Restrict` — delete account while transfers exist → API `409`); `holdings` → `Holding[]` (`onDelete: Cascade`); `assetTrades` → `AssetTrade[]` (`onDelete: Restrict`); `bondPositions` → `BondPosition[]` (`onDelete: Cascade`); `csvImportPresets` → `CsvImportPreset[]` (`onDelete: Cascade`); `importBatches` → `ImportBatch[]` (`onDelete: Cascade`).

## BondPosition

Polish retail treasury bond lot on a `TREASURY_BONDS` account (not equity `Holding` / Markets). Currency = account currency; create API requires `PLN`. Valuation: `backend/src/domain/bondValuation.ts` (actual/365 accrual, early-exit fee, Belka 19% estimate). Net worth / account equity uses **gross** (nominal + accrued); liquidation net is list/detail only.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK |
| accountId | Int | FK → Account (`onDelete: Cascade`) |
| seriesCode | String | e.g. `COI0328` |
| issuer | String | Default `SKARB_PANSTWA` |
| quantity | Decimal | Number of units |
| unitNominal | Decimal | Default 100 |
| unitPurchasePrice | Decimal | Per-unit purchase price (cost basis) |
| purchasedAt | DateTime | Purchase date |
| rateKind | String | `FIXED` \| `FLOATING` \| `INFLATION_LINKED` |
| currentAnnualRatePct | Decimal | Manual current-period annual rate % |
| couponFrequency | String | `ANNUAL` \| `SEMI_ANNUAL` \| `QUARTERLY` \| `AT_MATURITY` |
| periodStart | DateTime | Accrual period start |
| maturityDate | DateTime | Cap for accrual |
| earlyExitFeePerUnit | Decimal | Default 1 (PLN) |
| notes | String? | Optional |
| createdAt / updatedAt | DateTime | |

Indexes: `[accountId]`, `[accountId, maturityDate]`. Domain helpers: `backend/src/domain/bondPositions.ts`.

## CsvImportPreset

Account-scoped saved column mapping for flexible CSV import (MVP-023). Domain: `backend/src/domain/csvImportPresets.ts`.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK |
| userId | Int | FK → User (`onDelete: Cascade`) |
| accountId | Int | FK → Account (`onDelete: Cascade`) |
| name | String | Display name |
| nameKey | String | Lowercase trimmed; unique per account |
| mappingJson | String | JSON of header-name refs + optional `amountSignMode` |
| createdAt | DateTime | Default now |
| updatedAt | DateTime | `@updatedAt` |

Indexes: `[userId]`, `[accountId]`, unique `[accountId, nameKey]`.

## ImportBatch

Audit row written on successful cash ledger CSV commit (fixed header or column-mapped). Dedup itself compares fingerprints against existing `CashTransaction` rows — see `domain/cashImportDedup.ts`.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK |
| userId | Int | FK → User |
| accountId | Int | FK → Account |
| source | String | `ledger_csv` \| `columns_csv` |
| createdCount | Int | Rows inserted |
| skippedDuplicateCount | Int | Rows skipped as duplicates |
| skippedTransferCount | Int | `TRANSFER_*` CSV rows skipped |
| createdAt | DateTime | Default now |

Indexes: `[userId, createdAt]`, `[accountId, createdAt]`.

## CashTransfer

Source of truth for an internal cash transfer between two owned accounts. Create/update/delete mirror two ledger legs (`TRANSFER_OUT` / `TRANSFER_IN`) and adjust both balances atomically. Domain: `backend/src/domain/cashTransfers.ts`.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| userId | Int | FK → User (`onDelete: Cascade`) |
| fromAccountId | Int | FK → Account (`onDelete: Restrict`) |
| toAccountId | Int | FK → Account (`onDelete: Restrict`) |
| amountFrom | Int | Positive minor units on the source account |
| amountTo | Int | Positive minor units on the destination account |
| occurredAt | DateTime | Transfer time (default now) |
| description | String? | Optional note |
| categoryId | Int? | FK → Category (`onDelete: SetNull`); must be `ledgerType: TRANSFER`; copied onto both legs |
| createdAt | DateTime | Default now |
| updatedAt | DateTime | `@updatedAt` |

Indexes: `[userId, occurredAt]`, `[fromAccountId]`, `[toAccountId]`, `[categoryId]`. Same-currency transfers keep `amountTo = amountFrom`; cross-currency requires an explicit `amountTo` (manual FX; no NBP). Relation: `legs` → `CashTransaction[]` (`onDelete: Cascade`).

## Tag

User-scoped flat label for cash ledger rows (many tags per `INCOME`/`EXPENSE` transaction). Not a category substitute — categories stay a single optional `categoryId`. Unique name per user via `nameKey` (lowercase trim). Deleting a tag cascades join rows; transactions remain.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| userId | Int | FK → User (`onDelete: Cascade`) |
| name | String | Display name (max 80) |
| nameKey | String | Lowercase trim; unique with `userId` |
| createdAt | DateTime | Default now |

Indexes: `[userId]`, unique `[userId, nameKey]`. Domain: `backend/src/domain/tags.ts`. Join: `CashTransactionTag`.

## CashTransactionTag

M:N join between `CashTransaction` and `Tag`. Composite PK `[cashTransactionId, tagId]`. Both FKs `onDelete: Cascade`. Index on `[tagId]`.

## CashTransaction

Single-account cash ledger row. Positive `amount`; type drives signed effect on `Account.cashBalance`. User-created types are `INCOME` / `EXPENSE`. Transfer legs use `TRANSFER_OUT` / `TRANSFER_IN` and are excluded from cashflow statistics. Asset trade legs use `ASSET_BUY` / `ASSET_SELL` (also excluded from cashflow stats; included in `cashBalance` / balance history). No `balanceAfter`. Optional category (`INCOME`/`EXPENSE` for cash rows; `TRANSFER` for transfer legs via the transfer header). Optional many tags via `CashTransactionTag` on cash rows only (API `tagIds`). Edit/delete of transfer and asset legs only via their parent APIs.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| accountId | Int | FK → Account (`onDelete: Cascade`) |
| type | String | `INCOME`, `EXPENSE`, `TRANSFER_IN`, `TRANSFER_OUT`, `ASSET_BUY`, or `ASSET_SELL` |
| amount | Int | Always positive, minor units (cents). API JSON uses major units |
| occurredAt | DateTime | Movement time (default now) |
| description | String? | Optional note |
| categoryId | Int? | FK → Category (`onDelete: SetNull`) |
| transferId | Int? | FK → CashTransfer (`onDelete: Cascade`); set on transfer legs |
| assetTradeId | Int? | FK → AssetTrade (`onDelete: Cascade`); set on asset trade cash legs |
| createdAt | DateTime | Default now |

Indexes: `[accountId, occurredAt]`, `[categoryId]`, `[transferId]`, `[assetTradeId]`. Domain rules: `backend/src/domain/cashLedger.ts` (`CASH_TX_TYPES` vs `LEDGER_TX_TYPES`). Parsing and minor-unit conversion: `backend/src/domain/money.ts`. SQLite stores these integers so cent arithmetic does not pass through REAL. Tags: `backend/src/domain/tags.ts` (`assertOwnedTagIds`, `setTransactionTags`).

## FxRateDaily

Global (not user-scoped) NBP table A mid for one foreign currency on one calendar day. **PLN is never stored** (pivot mid = 1). MVP whitelist: **EUR**, **USD**.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| rateDate | DateTime | UTC midnight of NBP `effectiveDate` |
| currency | String | `EUR` or `USD` |
| mid | Decimal | Major PLN per 1 foreign unit |
| createdAt | DateTime | Default now |

Unique `[rateDate, currency]`; index `[currency, rateDate]`. Domain: `backend/src/domain/fx.ts`, `fxRates.ts`, `nbpClient.ts`. Sync CLI: `npm run fx:sync`. Net-worth and net-worth history read these rows only (latest mid on or before the valuation date via PLN pivot); they never call NBP over the network. Missing required rates fail closed.

## AppConfig

Global key/value settings (no `userId`). Key `marketLiveApi` value `"true"`|`"false"`; missing ⇒ live HTTP market fetches off. Domain: `backend/src/domain/appConfig.ts`.

## Instrument

Global market catalog (no `userId`). Full table from Twelve Data via `market:sync-catalog`. Curated subset marked `allowlisted` via `market:seed-universe` / `POST /api/instruments/allowlist`. Default Markets search filters `allowlisted=true`.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK |
| symbol | String | Display ticker (uppercase) |
| name | String | Issuer / fund name |
| exchange | String | Exchange code from provider |
| micCode | String? | Optional MIC |
| country | String? | Optional country |
| currency | String | Quote currency (e.g. `USD`) |
| assetClass | String | `STOCK` \| `ETF` \| `INDEX` |
| provider | String | Default `twelve_data` |
| providerSymbol | String | Symbol passed to Twelve Data APIs |
| allowlisted | Boolean | Default `false`; Markets search + quote/history universe |
| createdAt / updatedAt | DateTime | |

Unique `[provider, providerSymbol]`; indexes on `symbol`, `assetClass`, `name`, `[allowlisted, symbol]`, `[allowlisted, name]`. Domain: `instruments.ts`, `marketUniverse.ts`, `twelveDataClient.ts`, `marketData.ts`.

## InstrumentValuation

Global close for one instrument on one UTC day. **Active write path:** `yahoo` (Yahoo chart quotes + history). Legacy/dormant sources may still exist in DB: `twelve_data`, `oanor_gpw`, `stooq`. Watchlist reads the latest row **across sources**. Chart collapse prefers `yahoo` > `twelve_data` > `stooq` > `oanor_gpw`.

Stored fields only: `asOfDate` (UTC midnight), `close` (major units in instrument currency), `source`. No OHLC/volume rows.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK |
| instrumentId | Int | FK → Instrument (`onDelete: Cascade`) |
| asOfDate | DateTime | UTC midnight |
| close | Decimal | Major units in instrument currency |
| source | String | `yahoo` (primary) \| `twelve_data` \| `oanor_gpw` \| `stooq` |
| createdAt | DateTime | |

Unique `[instrumentId, asOfDate, source]`. Domain: `instrumentValuations.ts`, `yahooHistory.ts`, `marketData.ts`, `marketHistory.ts`. CLIs: `market:sync-quotes`, `market:sync-history-yahoo`.

## WatchlistItem

User favorite instrument for `/markets`.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK |
| userId | Int | FK → User (`onDelete: Cascade`) |
| instrumentId | Int | FK → Instrument (`onDelete: Cascade`) |
| createdAt | DateTime | |

Unique `[userId, instrumentId]`. Domain: `backend/src/domain/watchlist.ts`.

## Holding

Open position on one owned account for one instrument. `quantity` is a cache of open lot qty (synced after BUY/SELL). Eligible account types for trades: `BROKERAGE`, `IKE`, `IKZE`.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK |
| accountId | Int | FK → Account (`onDelete: Cascade`) |
| instrumentId | Int | FK → Instrument (`onDelete: Restrict`) |
| quantity | Decimal | Open qty in instrument units |
| createdAt / updatedAt | DateTime | |

Unique `[accountId, instrumentId]`. Domain: `backend/src/domain/holdings.ts`. MTM: `portfolioValuation.ts`.

## Lot

FIFO lot under a holding. BUY opens a lot; SELL closes oldest open qty first.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK |
| holdingId | Int | FK → Holding (`onDelete: Cascade`) |
| openTradeId | Int? | FK → AssetTrade (`onDelete: SetNull`) |
| openedAt | DateTime | Trade time |
| quantityOpen | Decimal | Remaining open qty |
| quantityClosed | Decimal | Closed qty |
| unitCost | Decimal | Per-unit cost in account/instrument currency (v1 same) |
| commissionOpen | Decimal | Commission allocated at open |
| createdAt / updatedAt | DateTime | |

Index `[holdingId, openedAt]`. Domain: `backend/src/domain/lots.ts`.

## LotClose

Allocation of a SELL onto one lot (enables delete/reverse).

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK |
| lotId | Int | FK → Lot (`onDelete: Cascade`) |
| tradeId | Int | FK → AssetTrade (`onDelete: Cascade`) |
| quantity | Decimal | Qty closed from this lot by the trade |
| commissionAllocated | Decimal | Commission removed from the lot at close (restored on reverse) |
| createdAt | DateTime | |

## AssetTrade

BUY/SELL on a brokerage-like account. Creates `ASSET_*` cash legs and lot open/close. v1: trade currency and instrument quote currency must equal account currency (no FX inside the trade).

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK |
| accountId | Int | FK → Account (`onDelete: Restrict`) |
| instrumentId | Int | FK → Instrument (`onDelete: Restrict`) |
| side | String | `BUY` \| `SELL` |
| quantity | Decimal | Positive |
| unitPrice | Decimal | Positive; major units |
| commission | Decimal | ≥ 0; major units |
| currency | String | Account currency |
| occurredAt | DateTime | |
| settlementDate | DateTime? | Optional |
| notes | String? | Optional |
| createdAt / updatedAt | DateTime | |

Domain: `backend/src/domain/assetTrades.ts`. Architecture note: [holdings-market-architecture.md](../explanation/holdings-market-architecture.md).
