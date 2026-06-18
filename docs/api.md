# API catalog

Implementation: [`backend/src/app.ts`](../backend/src/app.ts). Auth: `requireAuth` = Bearer JWT unless noted.

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | `email`, `username`, `password` |
| POST | `/api/auth/login` | No | `email`, `password` |
| GET | `/api/auth/me` | Yes | `{ id, email, username }` |

## Accounts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts` | Yes | List user accounts |
| POST | `/api/accounts` | Yes | Create account |
| GET | `/api/accounts/:id` | Yes | Account detail |
| PUT | `/api/accounts/:id` | Yes | Update name/description |
| DELETE | `/api/accounts/:id` | Yes | Delete account |
| GET | `/api/accounts/:id/valuations` | Yes | `AccountValuationDaily`; `from`, `to` |

## Transactions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transactions` | Yes | List; `accountId`, `from`, `to` |
| POST | `/api/transactions` | Yes | Create; sets `balanceAfter` |
| PUT | `/api/transactions/:id` | Yes | Update; recalculates balances |
| DELETE | `/api/transactions/:id` | Yes | Delete; recalculates balances |

## Instruments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/instruments` | Yes | Search; `q` |
| POST | `/api/instruments` | Yes | Create manual instrument |
| GET | `/api/instruments/:id/valuations` | Yes | Price history |
| POST | `/api/instruments/:id/valuations` | Yes | Add manual valuation |

## Holdings (brokerage)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/accounts/:accountId/holdings` | Yes | Open/closed holdings with metrics (`{ open, closed }`) |
| POST | `/api/accounts/:accountId/holdings` | Yes | Find-or-create holding for `instrumentId` |
| GET | `/api/holdings/:holdingId` | Yes | Single holding summary |
| GET | `/api/holdings/:holdingId/lots` | Yes | Trade history for holding |
| POST | `/api/holdings/:holdingId/lots` | Yes | BUY/SELL lot |
| DELETE | `/api/holding-lots/:id` | Yes | Delete lot; syncs holding quantity |
| GET | `/api/accounts/:accountId/holdings/:instrumentId/valuations` | Yes | Position value history |

## Stats

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stats/net-worth` | Yes | Net worth by account type; `currency` query converts each account value from its native currency via NBP rates (PLN base) |
| GET | `/api/stats/cashflow` | Yes | Period income/expense/net; `from`, `to` |
| GET | `/api/stats/expenses-by-category` | Yes | Expense breakdown by category string |
| GET | `/api/stats/income-by-category` | Yes | Income breakdown by category string |
