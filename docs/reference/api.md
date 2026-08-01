---
diataxis: reference
use_when: Look up REST routes
audience: both
related_code:
  - backend/src/app.ts
  - backend/src/routes/authRoutes.ts
  - backend/src/routes/accountsRoutes.ts
  - backend/src/routes/categoriesRoutes.ts
  - backend/src/routes/cashTransactionsRoutes.ts
  - backend/src/routes/statisticsRoutes.ts
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
| POST | `/api/auth/register` | No | Body: email, username, password. Seeds default category tree. 403 if registration disabled |
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

## Categories

User-scoped nested tree (`parentId`). Flat list responses include `id`, `name`, `parentId`, `createdAt`. Sibling name uniqueness is case-insensitive (domain). Delete with children → `409`.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/categories` | Bearer | Flat list, name ascending |
| POST | `/api/categories` | Bearer | Body: `name`; optional `parentId`. 201 |
| PATCH | `/api/categories/:id` | Bearer | Body: optional `name`, `parentId` (`null` = root). Cycle → 400 |
| DELETE | `/api/categories/:id` | Bearer | 409 if children; else 204 (`CashTransaction.categoryId` → null) |

Unknown / other-user category or parent → `404`.

## Cash transactions

Nested under an owned account. Cross-user or unknown account → `404`. `amount` must be positive. `type` is `INCOME` or `EXPENSE` (case-normalized). Create/delete adjust `Account.cashBalance` atomically (delete reverses). No PATCH / no `balanceAfter`. Optional `categoryId` must belong to the same user.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/accounts/:accountId/transactions` | Bearer | List for account (`occurredAt` desc, then `id` desc); includes `categoryId` |
| POST | `/api/accounts/:accountId/transactions` | Bearer | Body: `type`, `amount`; optional `occurredAt` (ISO, default now), `description`, `categoryId`. 201 |
| DELETE | `/api/accounts/:accountId/transactions/:id` | Bearer | Must match account; reverses balance. 204 |

## Statistics

Month bounds are **UTC** `[start, end)` on `CashTransaction.occurredAt`. No FX. Missing/invalid `month` → `400`. Period summary and cashflow history require `currency` as a 3-letter code (`^[A-Z]{3}$`); a currency the user does not hold returns zeros. History `months` must be `6`, `12`, or `24` when present (default `12`). Series is oldest → newest and zero-filled.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/statistics/category-breakdown` | Bearer | Query: `month=YYYY-MM`. Body: `{ month, income[], expense[] }` with rows `{ categoryId, categoryName, currency, total, count }` (per `(categoryId, currency)`; null category → `"Uncategorized"`) |
| GET | `/api/statistics/period-summary` | Bearer | Query: `month=YYYY-MM`, `currency=XXX`. Body: `{ month, currency, income, expense, net }` |
| GET | `/api/statistics/cashflow-history` | Bearer | Query: `month=YYYY-MM`, `currency=XXX`, optional `months` (6\|12\|24). Body: `{ currency, monthCount, series: [{ month, income, expense, net }] }` |
| GET | `/api/statistics/net-worth` | Bearer | Query: `currency=XXX`. Body: `{ currency, byBucket: { cash, stock, crypto, metal, real_estate, other }, liabilities, netWorth }` — sums `Account.cashBalance` by account type (no FX; `liabilities` always `0` until liability model) |
| GET | `/api/statistics/cashflow-rolling-12m` | Bearer | Query: `currency=XXX`. Body: `{ currency, monthCount, fromMonth, toMonth, avgIncome, avgExpense, avgNet }` — averages over last 12 complete UTC months (excludes current month) |
