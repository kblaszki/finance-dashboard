---
diataxis: reference
use_when: Look up REST routes
audience: both
related_code:
  - backend/src/app.ts
  - backend/src/routes/authRoutes.ts
  - backend/src/routes/accountsRoutes.ts
  - backend/src/routes/cashTransactionsRoutes.ts
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

User-scoped. Cross-user access returns `404`. Create accepts allow-listed `accountType` values (`accountType` omitted/blank → `BANK`).

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/accounts` | Bearer | List own accounts (newest first); includes `totalBalance` |
| POST | `/api/accounts` | Bearer | Body: `name`; optional `currency` (default PLN), `openingBalance`, `openingCashAsOf`, `description`, `accountType` (`BANK`, `BROKERAGE`, `CRYPTO`, `PRECIOUS_METAL`, `REAL_ESTATE`, `OTHER`, `MANUAL`). Sets `cashBalance = openingBalance`. 201 |
| GET | `/api/accounts/:id` | Bearer | One owned account |
| PATCH | `/api/accounts/:id` | Bearer | Body: optional `name`, `currency`, `description` (no balance or `accountType` edits) |
| DELETE | `/api/accounts/:id` | Bearer | 204 |

Duplicate name for the same user → `400`. Unknown `accountType` → `400`.

## Cash transactions

Nested under an owned account. Cross-user or unknown account → `404`. `amount` must be positive. `type` is `INCOME` or `EXPENSE` (case-normalized). Create/delete adjust `Account.cashBalance` atomically (delete reverses). No PATCH / no `balanceAfter`.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/accounts/:accountId/transactions` | Bearer | List for account (`occurredAt` desc, then `id` desc) |
| POST | `/api/accounts/:accountId/transactions` | Bearer | Body: `type`, `amount`; optional `occurredAt` (ISO, default now), `description`. 201 |
| DELETE | `/api/accounts/:accountId/transactions/:id` | Bearer | Must match account; reverses balance. 204 |
