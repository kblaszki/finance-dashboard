---
diataxis: reference
use_when: Look up REST routes
audience: both
related_code:
  - backend/src/app.ts
  - backend/src/routes/authRoutes.ts
  - backend/src/routes/accountsRoutes.ts
  - backend/src/routes/mountRouters.ts
---

# API reference

Hub: [docs/README.md](../README.md).

## Health

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/health` | No | `{ ok, db }` — DB ping |

## Auth

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/auth/config` | No | `{ allowRegister }` |
| POST | `/api/auth/register` | No | Body: email, username, password. 403 if registration disabled |
| POST | `/api/auth/login` | No | Body: login (email or username) or email + password |
| GET | `/api/auth/me` | Bearer | Current user `{ id, email, username }` |
| PATCH | `/api/auth/profile` | Bearer | Body: username |
| PATCH | `/api/auth/password` | Bearer | Body: currentPassword, newPassword |
| PATCH | `/api/auth/email` | Bearer | Body: email, currentPassword |

Password minimum length: 8. JWT expiry: 7 days.

In production, login/register are rate-limited (see [environment.md](environment.md)).

## Accounts

User-scoped. Cross-user access returns `404`. Create currently accepts **BANK** only (`accountType` omitted → `BANK`).

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/accounts` | Bearer | List own accounts (newest first); includes `totalBalance` |
| POST | `/api/accounts` | Bearer | Body: `name`; optional `currency` (default PLN), `openingBalance`, `openingCashAsOf`, `description`, `accountType` (`BANK` only). Sets `cashBalance = openingBalance`. 201 |
| GET | `/api/accounts/:id` | Bearer | One owned account |
| PATCH | `/api/accounts/:id` | Bearer | Body: optional `name`, `currency`, `description` (no balance edits) |
| DELETE | `/api/accounts/:id` | Bearer | 204 |

Duplicate name for the same user → `400`. Non-BANK `accountType` → `400`.
