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

User-scoped financial account. This slice supports **BANK** create only; `accountType` remains a string for later types.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| userId | Int | FK → User |
| accountType | String | `BANK` for current create API |
| name | String | Unique per user (`@@unique([userId, name])`) |
| currency | String | ISO-like 3-letter code (stored uppercase) |
| cashBalance | Decimal | Working cash; set from `openingBalance` on create |
| openingBalance | Decimal | Opening cash seed (default 0) |
| openingCashAsOf | DateTime? | Optional opening date |
| description | String? | Optional note |
| createdAt | DateTime | Default now |
| updatedAt | DateTime | `@updatedAt` |

Indexes: `[userId, accountType]`. API responses also expose computed `totalBalance` (= `cashBalance` for BANK until holdings exist).
