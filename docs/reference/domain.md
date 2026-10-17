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
| cashTransfers | CashTransfer[] | Owned internal transfers (`onDelete: Cascade`) |

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

Indexes: `[userId]`, `[parentId]`, `[userId, ledgerType]`, unique `[userId, nameKey]`. Domain: `backend/src/domain/categories.ts`. Seeded on register / create-user / demo seed.

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

Indexes: `[userId, accountType]`. API responses also expose computed `totalBalance` (= `cashBalance` until holdings exist). Allow-list: `backend/src/domain/accountTypes.ts`. Relations: `cashTransactions` → `CashTransaction[]` (`onDelete: Cascade`); `transfersFrom` / `transfersTo` → `CashTransfer[]` (`onDelete: Restrict` — delete account while transfers exist → API `409`).

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

## CashTransaction

Single-account cash ledger row. Positive `amount`; type drives signed effect on `Account.cashBalance`. User-created types are `INCOME` / `EXPENSE`. Transfer legs use `TRANSFER_OUT` / `TRANSFER_IN` and are excluded from cashflow statistics. No `balanceAfter`. Optional category tag (`INCOME`/`EXPENSE` for cash rows; `TRANSFER` for transfer legs via the transfer header).

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

Indexes: `[accountId, occurredAt]`, `[categoryId]`, `[transferId]`. Domain rules: `backend/src/domain/cashLedger.ts` (`CASH_TX_TYPES` vs `LEDGER_TX_TYPES`). Parsing and minor-unit conversion: `backend/src/domain/money.ts`. SQLite stores these integers so cent arithmetic does not pass through REAL.
