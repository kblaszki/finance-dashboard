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
| GET | `/api/categories/export` | Bearer | CSV download; header `path,ledgerType`; full tree paths (`Food/Groceries`); parents before children; empty tree = header only |
| POST | `/api/categories/import/preview` | Bearer | Body `{ csv }`. `200 { rowCount, existing, toCreate, rows: [{ path, ledgerType, status: "exists"\|"create" }] }`. Same path with different owned `ledgerType` → `400` |
| POST | `/api/categories/import` | Bearer | Body `{ csv }`. Merge only: skip exact path+ledgerType matches, create missing (parents first); `201 { created, skipped }`; no deletes |
| POST | `/api/categories` | Bearer | Body: `name`; optional `parentId`; `ledgerType` (`INCOME`\|`EXPENSE`\|`TRANSFER`) required when `parentId` is null/omitted. 201 |
| PATCH | `/api/categories/:id` | Bearer | Body: optional `name`, `parentId` (`null` = root). Cycle / cross-type reparent → 400 |
| DELETE | `/api/categories/:id` | Bearer | 409 if children; else 204 (`CashTransaction.categoryId` → null) |

Unknown / other-user category or parent → `404`.

## Tags

User-scoped flat labels (`Tag`). Responses include `id`, `name`, `createdAt`. Name uniqueness is case-insensitive via `nameKey`. Delete cascades `CashTransactionTag` joins; cash rows remain. Tags are not included in ledger/transfers CSV; period tag totals use `GET /api/statistics/tag-breakdown`.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/tags` | Bearer | List own tags, name ascending |
| POST | `/api/tags` | Bearer | Body `{ name }`. 201 |
| PATCH | `/api/tags/:id` | Bearer | Body `{ name }`. 200 |
| DELETE | `/api/tags/:id` | Bearer | 204 (join cascade) |

Unknown / other-user tag → `404`. Duplicate name → `400`.

## Cash transactions

Nested under an owned account. Cross-user or unknown account → `404`. `amount` must be positive, with at most 2 decimal places (stored as integer cents; JSON stays a major-unit number). User create/update `type` is `INCOME` or `EXPENSE` (case-normalized). Transfer legs (`TRANSFER_IN` / `TRANSFER_OUT`) appear in list/export with `transferId` set; PATCH/DELETE on those rows → `400` (“edit or delete via /api/transfers”). Create, update, and delete of user cash rows adjust `Account.cashBalance` atomically. No `balanceAfter`. Optional `categoryId` must belong to the same user and match the expected category group for the row type (`INCOME`/`EXPENSE` equal type; `TRANSFER_IN`/`TRANSFER_OUT` → `TRANSFER`) (else `400`). Optional `tagIds` (`number[]`, empty = none) must be owned tags; replace-on-write for create/PATCH when provided. Transfer legs always return `tagIds: []`. `occurredAt` is an absolute instant; month statistics bucket it in UTC. CSV import skips `TRANSFER_*` rows (reported in `skippedTransfers`); restore transfers via `/api/transfers`. CSV does not include tags.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/accounts/:accountId/transactions` | Bearer | List for account (`occurredAt` desc, then `id` desc); includes `categoryId`, `tagIds`, `transferId` |
| GET | `/api/accounts/:accountId/transactions/export` | Bearer | CSV download (`text/csv; charset=utf-8`); header `id,type,amount,currency,occurredAt,description,categoryPath,createdAt`; `categoryPath` is the full tree path (`Food/Groceries`, `/` and `\` escaped in segment names); rows oldest→newest (includes `TRANSFER_*` legs, usually without path); empty ledger = header only; `Content-Disposition: attachment; filename="account-{id}-cash.csv"` |
| POST | `/api/accounts/:accountId/transactions/import/preview` | Bearer | Body `{ csv: string }`. Validates CSV (current `categoryPath` header, or legacy `categoryId,categoryName` from older exports). Legacy rows: owned `categoryId` with matching `ledgerType` → full tree path; else `categoryName` as a single path segment. `200 { rowCount, categories: [{ path, ledgerType, rowCount, suggestedCategoryId }], skipped, skippedTransfers: [{ row, type, message }] }` — `rowCount` is importable INCOME/EXPENSE only; `TRANSFER_*` rows are listed in `skippedTransfers` (not `400`). Exact path+`ledgerType` suggestions only. |
| POST | `/api/accounts/:accountId/transactions/import` | Bearer | Body `{ csv: string, categoryMappings: [{ path, ledgerType, action: "map", categoryId } \| { path, ledgerType, action: "create" } \| { path, ledgerType, action: "none" }] }`. Every used `(path, ledgerType)` needs exactly one mapping; `create` reuses matching path segments and creates missing ones; always creates new rows (`id`/`createdAt` ignored); currency must match account; INCOME/EXPENSE all-or-nothing; `TRANSFER_*` skipped; `201 { created, createdCategories, skipped, skippedTransfers }`; `400 { error, details: [{ row, message }] }` |
| POST | `/api/accounts/:accountId/transactions` | Bearer | Body: `type`, `amount`; optional `occurredAt` (ISO instant, default now), `description`, `categoryId`, `tagIds`. 201 |
| PATCH | `/api/accounts/:accountId/transactions/:id` | Bearer | Body: optional `type`, `amount`, `occurredAt`, `description`, `categoryId`, `tagIds`. At least one field. Adjusts `cashBalance` by the signed difference. Transfer legs → 400. 200 |
| DELETE | `/api/accounts/:accountId/transactions/:id` | Bearer | Must match account; reverses balance. Transfer legs → 400. 204 |

## Transfers

User-scoped internal cash transfers (`CashTransfer` header + two ledger legs). Cross-user or unknown account → `404`. Same currency: `amountTo` optional (defaults to `amountFrom`); mismatched values → `400`. Different currencies: `amountTo` required. Response includes major-unit `amountFrom` / `amountTo`, account currencies, and computed `fxRate` (`amountTo / amountFrom`). Create/update/delete run in one DB transaction and reverse/recreate legs as needed.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/transfers` | Bearer | List own transfers (`occurredAt` desc, then `id` desc); includes optional `categoryId` |
| GET | `/api/transfers/export` | Bearer | CSV download; header `id,occurredAt,fromAccount,fromCurrency,toAccount,toCurrency,amountFrom,amountTo,description,categoryPath,createdAt`; accounts by name (no DB ids); `categoryPath` is TRANSFER-tree path or empty; oldest→newest; empty = header only. Legacy header without `categoryPath` still accepted on import |
| POST | `/api/transfers/import/preview` | Bearer | Body `{ csv, accountMappings? }`. Always `{ rowCount, accounts: [{ name, currency, rowCount, suggestedAccountId }] }` (exact name+currency suggestions). With complete `accountMappings`: also `rows: [{ row, occurredAt, fromAccountId, toAccountId, amountFrom, amountTo, description, duplicate }]` |
| POST | `/api/transfers/import` | Bearer | Body `{ csv, accountMappings: [{ name, currency, accountId }], skipRows?: number[] }`. Map-only (no account create); every used `(name, currency)` required; currency must match mapped account; optional `categoryPath` must resolve to an owned TRANSFER category (else `400`); all-or-nothing via `createTransfer`. `201 { created, skipped }`. `400 { error, details }` |
| POST | `/api/transfers` | Bearer | Body: `fromAccountId`, `toAccountId`, `amountFrom`; optional `amountTo`, `occurredAt`, `description`, `categoryId` (owned `TRANSFER` category). Same account → 400. 201; both legs get the same `categoryId` |
| PATCH | `/api/transfers/:id` | Bearer | Body: any subset of create fields (incl. `categoryId`); validated on merged state. 200 |
| DELETE | `/api/transfers/:id` | Bearer | Reverses both legs and deletes header. 204 |

## Statistics

Period bounds are **UTC** `[start, end)` on `occurredAt`. Query `month=YYYY-MM` is the anchor; optional `period=month|quarter|year` (default `month`) expands to that calendar month, the quarter containing it, or the calendar year. Responses include `period` and a short `label` (`2026-03`, `2026 Q1`, `2026`). Cashflow income/expense/net still count only `INCOME` / `EXPENSE` ledger rows — transfer legs are ignored for those totals. Transfer volume and transfer-by-category use `CashTransfer.amountFrom` (from-account currency) and are separate from net. Tag breakdown attributes the full cash amount to each attached tag (multi-tag double-counts) plus an untagged bucket. Account `balance-history` includes all ledger types (`TRANSFER_*` too). No FX conversion in stats. Missing/invalid `month` or `period` → `400`. Period summary, tag breakdown, and cashflow history require `currency` as a 3-letter code (`^[A-Z]{3}$`); a currency the user does not hold returns zeros. History `months` must be `6`, `12`, or `24` when present (default `12`); the series ends at the last month of the selected period. Series is oldest → newest and zero-filled.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/statistics/category-breakdown` | Bearer | Query: `month=YYYY-MM`, optional `period`. Body: `{ month, period, label, income[], expense[], transfer[] }` with rows `{ categoryId, categoryName, currency, total, count }` (per `(categoryId, currency)`; null category → `"Uncategorized"`). `transfer[]` from `CashTransfer` |
| GET | `/api/statistics/period-summary` | Bearer | Query: `month=YYYY-MM`, `currency=XXX`, optional `period`. Body: `{ month, period, label, currency, income, expense, net, transfers }` (`transfers` = sum of `amountFrom` in that currency; not part of `net`) |
| GET | `/api/statistics/tag-breakdown` | Bearer | Query: `month=YYYY-MM`, `currency=XXX`, optional `period`. Body: `{ month, period, label, currency, income[], expense[], untagged: { income, expense, incomeCount, expenseCount } }` with tag rows `{ tagId, tagName, total, count }` |
| GET | `/api/statistics/cashflow-history` | Bearer | Query: `month=YYYY-MM`, `currency=XXX`, optional `months` (6\|12\|24), optional `period`. Body: `{ currency, monthCount, series: [{ month, income, expense, net }] }` |
| GET | `/api/statistics/net-worth` | Bearer | Query: `currency=XXX`. Body: `{ currency, byBucket: { cash, stock, crypto, metal, real_estate, other }, liabilities, netWorth }` — sums `Account.cashBalance` by account type (no FX). `CREDIT_CARD` debt (`cashBalance < 0`) adds to `liabilities` and is excluded from buckets; overpayment (`> 0`) goes to `cash`. `IKE`/`IKZE` → stock; `TREASURY_BONDS` → other. Mortgage-style FR-029 liabilities still separate. |
| GET | `/api/statistics/cashflow-rolling-12m` | Bearer | Query: `currency=XXX`. Body: `{ currency, monthCount, fromMonth, toMonth, avgIncome, avgExpense, avgNet }` — averages over last 12 complete UTC months (excludes current month) |
