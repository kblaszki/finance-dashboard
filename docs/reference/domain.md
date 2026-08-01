---
diataxis: reference
use_when: Look up Prisma models
audience: both
related_code:
  - backend/prisma/schema.prisma
---

# Domain reference

Hub: [docs/README.md](../README.md).

Auth-only baseline. Planned models live in the product map under [mvp/](../../mvp/).

## User

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| email | String | Unique |
| username | String | Unique |
| passwordHash | String | bcrypt |
| createdAt | DateTime | Default now |

No other models in `schema.prisma`.
