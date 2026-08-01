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
| username | String | Unique |
| passwordHash | String | bcrypt |
| createdAt | DateTime | Default now |
| accounts | Account[] | Owned accounts (`onDelete: Cascade`) |

## Account

User-scoped financial account. Create accepts allow-listed types; `accountType` is a validated string (not a Prisma enum).

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| userId | Int | FK → User |
| accountType | String | `BANK`, `BROKERAGE`, `CRYPTO`, `PRECIOUS_METAL`, `REAL_ESTATE`, `OTHER`, `MANUAL` (omit/blank → `BANK`) |
| name | String | Unique per user (`@@unique([userId, name])`) |
| currency | String | ISO-like 3-letter code (stored uppercase) |
| cashBalance | Decimal | Working cash; set from `openingBalance` on create |
| openingBalance | Decimal | Opening cash seed (default 0) |
| openingCashAsOf | DateTime? | Optional opening date |
| description | String? | Optional note |
| createdAt | DateTime | Default now |
| updatedAt | DateTime | `@updatedAt` |

Indexes: `[userId, accountType]`. API responses also expose computed `totalBalance` (= `cashBalance` until holdings exist). Allow-list: `backend/src/domain/accountTypes.ts`.
