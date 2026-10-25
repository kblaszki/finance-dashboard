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

Indexes: `[userId]`, `[parentId]`, `[userId, ledgerType]`, unique `[userId, nameKey]`. Domain: `backend/src/domain/categories.ts`. Seeded on register / create-user / demo seed.

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
| accountType | String | `BANK`, `BROKERAGE`, `CRYPTO`, `PRECIOUS_METAL`, `REAL_ESTATE`, `CREDIT_CARD`, `IKE`, `IKZE`, `TREASURY_BONDS`, `OTHER`, `MANUAL` (omit/blank → `BANK`). `CREDIT_CARD` uses signed `cashBalance` (≤ 0 = debt). `IKE` / `IKZE` / `TREASURY_BONDS` are cash sleeves for now (holdings later). |
| name | String | Unique per user (`@@unique([userId, name])`) |
| currency | String | ISO-like 3-letter code (stored uppercase) |
| cashBalance | Int | Working cash in minor units (cents). API JSON uses major units |
| openingBalance | Int | Opening cash seed in minor units (default 0) |
| openingCashAsOf | DateTime? | Optional opening date |
| description | String? | Optional note |
| createdAt | DateTime | Default now |
| updatedAt | DateTime | `@updatedAt` |

Indexes: `[userId, accountType]`. API responses also expose computed `totalBalance` (= `cashBalance` until holdings exist). Allow-list: `backend/src/domain/accountTypes.ts`. Relations: `cashTransactions` → `CashTransaction[]` (`onDelete: Cascade`); `transfersFrom` / `transfersTo` → `CashTransfer[]` (`onDelete: Restrict` — delete account while transfers exist → API `409`); `csvImportPresets` → `CsvImportPreset[]` (`onDelete: Cascade`); `importBatches` → `ImportBatch[]` (`onDelete: Cascade`).

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

Single-account cash ledger row. Positive `amount`; type drives signed effect on `Account.cashBalance`. User-created types are `INCOME` / `EXPENSE`. Transfer legs use `TRANSFER_OUT` / `TRANSFER_IN` and are excluded from cashflow statistics. No `balanceAfter`. Optional category (`INCOME`/`EXPENSE` for cash rows; `TRANSFER` for transfer legs via the transfer header). Optional many tags via `CashTransactionTag` on cash rows only (API `tagIds`).

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| accountId | Int | FK → Account (`onDelete: Cascade`) |
| type | String | `INCOME`, `EXPENSE`, `TRANSFER_IN`, or `TRANSFER_OUT` |
| amount | Int | Always positive, minor units (cents). API JSON uses major units |
| occurredAt | DateTime | Movement time (default now) |
| description | String? | Optional note |
| categoryId | Int? | FK → Category (`onDelete: SetNull`) |
| transferId | Int? | FK → CashTransfer (`onDelete: Cascade`); set on transfer legs |
| createdAt | DateTime | Default now |

Indexes: `[accountId, occurredAt]`, `[categoryId]`, `[transferId]`. Domain rules: `backend/src/domain/cashLedger.ts` (`CASH_TX_TYPES` vs `LEDGER_TX_TYPES`). Parsing and minor-unit conversion: `backend/src/domain/money.ts`. SQLite stores these integers so cent arithmetic does not pass through REAL. Tags: `backend/src/domain/tags.ts` (`assertOwnedTagIds`, `setTransactionTags`).

## FxRateDaily

Global (not user-scoped) NBP table A mid for one foreign currency on one calendar day. **PLN is never stored** (pivot mid = 1). MVP whitelist: **EUR**, **USD**.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| rateDate | DateTime | UTC midnight of NBP `effectiveDate` |
| currency | String | `EUR` or `USD` |
| mid | Decimal | Major PLN per 1 foreign unit |
| createdAt | DateTime | Default now |

Unique `[rateDate, currency]`; index `[currency, rateDate]`. Domain: `backend/src/domain/fx.ts`, `fxRates.ts`, `nbpClient.ts`. Sync CLI: `npm run fx:sync`.
