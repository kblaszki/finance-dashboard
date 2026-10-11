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
  - backend/src/routes/transfersRoutes.ts
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
| POST | `/api/auth/register` | No | Body: email, username, password. Seeds default category tree. 403 if registration disabled. Duplicate email or username (any case) → `409` |
| POST | `/api/auth/login` | No | Body: login (email or username) or email + password. Username match is case-insensitive |
| GET | `/api/auth/me` | Bearer | Current user. Missing or revoked token → `401` |
| PATCH | `/api/auth/profile` | Bearer | Body: username. Duplicate username → `409` |
| PATCH | `/api/auth/password` | Bearer | Body: currentPassword, newPassword. Wrong current password → `400` (session stays). Success increments `tokenVersion` and older tokens get `401` |
| PATCH | `/api/auth/email` | Bearer | Body: email, currentPassword. Wrong current password → `400`. Duplicate email → `409` |

Password minimum length: 8. JWT expiry: 7 days (HS256). Account `name` is at most 100 characters. Account and cash-transaction `description` are at most 500 characters.

In production, login, register, password, and email changes share one rate limit (see [environment.md](environment.md)).

## Accounts

User-scoped. Cross-user access returns `404`. Create accepts allow-listed `accountType` values (`accountType` omitted/blank → `BANK`).

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/accounts` | Bearer | List own accounts (newest first); includes `totalBalance` |
| POST | `/api/accounts` | Bearer | Body: `name`; optional `currency` (default PLN), `openingBalance` (major units, at most 2 decimal places; negative allowed — use for credit-card debt), `openingCashAsOf`, `description`, `accountType` (`BANK`, `BROKERAGE`, `CRYPTO`, `PRECIOUS_METAL`, `REAL_ESTATE`, `CREDIT_CARD`, `IKE`, `IKZE`, `TREASURY_BONDS`, `OTHER`, `MANUAL`). Sets `cashBalance = openingBalance`. Balances are stored as integer cents and returned as major-unit numbers. 201 |
| GET | `/api/accounts/:id` | Bearer | One owned account |
| GET | `/api/accounts/:id/balance-history` | Bearer | End-of-month cash balances derived from `openingBalance` + ledger. Query: optional `month` (YYYY-MM, default current UTC month), `months` (`6`/`12`/`24`, default `12`). Response: `{ accountId, currency, monthCount, series: [{ month, balance }] }` (major units). 404 if not owned. |
| PATCH | `/api/accounts/:id` | Bearer | Body: optional `name`, `currency`, `description` (no balance or `accountType` edits). Changing `currency` returns `409` when the account has any cash transaction; the same code is allowed. Invalid currency is `400`. |
| DELETE | `/api/accounts/:id` | Bearer | 204; `409` when the account appears in any `CashTransfer` (delete transfers first) |

Duplicate name for the same user → `400`. Unknown `accountType` → `400`.

## Categories

User-scoped nested tree (`parentId`). Flat list responses include `id`, `name`, `parentId`, `ledgerType` (`INCOME` \| `EXPENSE`), `createdAt`. Sibling name uniqueness is case-insensitive and stored as `nameKey` (`{parentId or 0}:{lowercase name}`). Children inherit `ledgerType` from the parent; root create requires `ledgerType`. Rename and same-type reparent run in one transaction; cross-type reparent or changing `ledgerType` → `400`. Delete with children → `409`.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/categories` | Bearer | Flat list, name ascending |
| POST | `/api/categories` | Bearer | Body: `name`; optional `parentId`; `ledgerType` required when `parentId` is null/omitted. 201 |
| PATCH | `/api/categories/:id` | Bearer | Body: optional `name`, `parentId` (`null` = root). Cycle / cross-type reparent → 400 |
| DELETE | `/api/categories/:id` | Bearer | 409 if children; else 204 (`CashTransaction.categoryId` → null) |

Unknown / other-user category or parent → `404`.

## Cash transactions

Nested under an owned account. Cross-user or unknown account → `404`. `amount` must be positive, with at most 2 decimal places (stored as integer cents; JSON stays a major-unit number). User create/update `type` is `INCOME` or `EXPENSE` (case-normalized). Transfer legs (`TRANSFER_IN` / `TRANSFER_OUT`) appear in list/export with `transferId` set; PATCH/DELETE on those rows → `400` (“edit or delete via /api/transfers”). Create, update, and delete of user cash rows adjust `Account.cashBalance` atomically. No `balanceAfter`. Optional `categoryId` must belong to the same user and have `ledgerType` equal to the transaction `type` (else `400`). `occurredAt` is an absolute instant; month statistics bucket it in UTC. CSV import rejects `TRANSFER_*` types.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/accounts/:accountId/transactions` | Bearer | List for account (`occurredAt` desc, then `id` desc); includes `categoryId`, `transferId` |
| GET | `/api/accounts/:accountId/transactions/export` | Bearer | CSV download (`text/csv; charset=utf-8`); header `id,type,amount,currency,occurredAt,description,categoryId,categoryName,createdAt`; rows oldest→newest (includes `TRANSFER_*` legs); empty ledger = header only; `Content-Disposition: attachment; filename="account-{id}-cash.csv"` |
| POST | `/api/accounts/:accountId/transactions/import` | Bearer | Body `{ csv: string }` same header as export; always creates new rows (`id`/`createdAt` ignored); currency required and must match the account; category by owned `categoryId` or unique `categoryName` with matching `ledgerType`; `TRANSFER_*` rows rejected; all-or-nothing; `201 { created }`; `400 { error, details: [{ row, message }] }` |
| POST | `/api/accounts/:accountId/transactions` | Bearer | Body: `type`, `amount`; optional `occurredAt` (ISO instant, default now), `description`, `categoryId`. 201 |
| PATCH | `/api/accounts/:accountId/transactions/:id` | Bearer | Body: optional `type`, `amount`, `occurredAt`, `description`, `categoryId`. At least one field. Adjusts `cashBalance` by the signed difference. Transfer legs → 400. 200 |
| DELETE | `/api/accounts/:accountId/transactions/:id` | Bearer | Must match account; reverses balance. Transfer legs → 400. 204 |

## Transfers

User-scoped internal cash transfers (`CashTransfer` header + two ledger legs). Cross-user or unknown account → `404`. Same currency: `amountTo` optional (defaults to `amountFrom`); mismatched values → `400`. Different currencies: `amountTo` required. Response includes major-unit `amountFrom` / `amountTo`, account currencies, and computed `fxRate` (`amountTo / amountFrom`). Create/update/delete run in one DB transaction and reverse/recreate legs as needed.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/transfers` | Bearer | List own transfers (`occurredAt` desc, then `id` desc) |
| POST | `/api/transfers` | Bearer | Body: `fromAccountId`, `toAccountId`, `amountFrom`; optional `amountTo`, `occurredAt`, `description`. Same account → 400. 201 |
| PATCH | `/api/transfers/:id` | Bearer | Body: any subset of create fields; validated on merged state. 200 |
| DELETE | `/api/transfers/:id` | Bearer | Reverses both legs and deletes header. 204 |

## Statistics

Month bounds are **UTC** `[start, end)` on `CashTransaction.occurredAt`. Cashflow endpoints (`period-summary`, `category-breakdown`, `cashflow-history`, rolling averages) count only `INCOME` / `EXPENSE` — transfer legs are ignored. Account `balance-history` includes all ledger types (`TRANSFER_*` too). No FX conversion in stats. Missing/invalid `month` → `400`. Period summary and cashflow history require `currency` as a 3-letter code (`^[A-Z]{3}$`); a currency the user does not hold returns zeros. History `months` must be `6`, `12`, or `24` when present (default `12`). Series is oldest → newest and zero-filled.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/statistics/category-breakdown` | Bearer | Query: `month=YYYY-MM`. Body: `{ month, income[], expense[] }` with rows `{ categoryId, categoryName, currency, total, count }` (per `(categoryId, currency)`; null category → `"Uncategorized"`) |
| GET | `/api/statistics/period-summary` | Bearer | Query: `month=YYYY-MM`, `currency=XXX`. Body: `{ month, currency, income, expense, net }` |
| GET | `/api/statistics/cashflow-history` | Bearer | Query: `month=YYYY-MM`, `currency=XXX`, optional `months` (6\|12\|24). Body: `{ currency, monthCount, series: [{ month, income, expense, net }] }` |
| GET | `/api/statistics/net-worth` | Bearer | Query: `currency=XXX`. Body: `{ currency, byBucket: { cash, stock, crypto, metal, real_estate, other }, liabilities, netWorth }` — sums `Account.cashBalance` by account type (no FX). `CREDIT_CARD` debt (`cashBalance < 0`) adds to `liabilities` and is excluded from buckets; overpayment (`> 0`) goes to `cash`. `IKE`/`IKZE` → stock; `TREASURY_BONDS` → other. Mortgage-style FR-029 liabilities still separate. |
| GET | `/api/statistics/cashflow-rolling-12m` | Bearer | Query: `currency=XXX`. Body: `{ currency, monthCount, fromMonth, toMonth, avgIncome, avgExpense, avgNet }` — averages over last 12 complete UTC months (excludes current month) |
