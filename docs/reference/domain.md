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

## Category

User-scoped nested label (`parentId` self-relation). Each row has a fixed `ledgerType` (`INCOME` | `EXPENSE`) inherited from its parent (roots set it on create). Reparent across types is rejected. Default seed still uses display names Income / Expense, but scoping does not depend on those names.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| userId | Int | FK → User |
| name | String | Display name (roots may be renamed) |
| nameKey | String | Unique per user with the parent: `{parentId or 0}:{lowercase name}` |
| ledgerType | String | `INCOME` or `EXPENSE`; immutable after create |
| parentId | Int? | FK → Category (`onDelete: Restrict`); null = root |
| createdAt | DateTime | Default now |

Indexes: `[userId]`, `[parentId]`, `[userId, ledgerType]`, unique `[userId, nameKey]`. Domain: `backend/src/domain/categories.ts`. Seeded on register / create-user / demo seed.

## Account

User-scoped financial account. Create accepts allow-listed types; `accountType` is a validated string (not a Prisma enum).

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| userId | Int | FK → User |
| accountType | String | `BANK`, `BROKERAGE`, `CRYPTO`, `PRECIOUS_METAL`, `REAL_ESTATE`, `OTHER`, `MANUAL` (omit/blank → `BANK`) |
| name | String | Unique per user (`@@unique([userId, name])`) |
| currency | String | ISO-like 3-letter code (stored uppercase) |
| cashBalance | Int | Working cash in minor units (cents). API JSON uses major units |
| openingBalance | Int | Opening cash seed in minor units (default 0) |
| openingCashAsOf | DateTime? | Optional opening date |
| description | String? | Optional note |
| createdAt | DateTime | Default now |
| updatedAt | DateTime | `@updatedAt` |

Indexes: `[userId, accountType]`. API responses also expose computed `totalBalance` (= `cashBalance` until holdings exist). Allow-list: `backend/src/domain/accountTypes.ts`. Relation: `cashTransactions` → `CashTransaction[]` (`onDelete: Cascade`).

## CashTransaction

Single-account cash ledger row (INCOME / EXPENSE). Positive `amount`; type drives signed effect on `Account.cashBalance`. No `balanceAfter`. Optional category tag.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| accountId | Int | FK → Account (`onDelete: Cascade`) |
| type | String | `INCOME` or `EXPENSE` |
| amount | Int | Always positive, minor units (cents). API JSON uses major units |
| occurredAt | DateTime | Movement time (default now) |
| description | String? | Optional note |
| categoryId | Int? | FK → Category (`onDelete: SetNull`) |
| createdAt | DateTime | Default now |

Indexes: `[accountId, occurredAt]`, `[categoryId]`. Domain rules: `backend/src/domain/cashLedger.ts`. Parsing and minor-unit conversion: `backend/src/domain/money.ts`. SQLite stores these integers so cent arithmetic does not pass through REAL.
