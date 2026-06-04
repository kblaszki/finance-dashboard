# Finance Dashboard

A full-stack app for reviewing finances (income, expenses, investment portfolio), built with:

- Backend: Node.js + TypeScript + Express + Prisma + SQLite
- Frontend: Vite + React + TypeScript

## Requirements

- Node.js 18+
- npm

## Installation

From the project root (`finance-dashboard/`):

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

## Development

In a single terminal, from the project root:

```bash
npm run dev
```

By default:

- Backend runs at `http://localhost:4000`
- Frontend runs at `http://localhost:5173`

To run them separately:

```bash
# backend
cd backend
npm run dev

# frontend
cd frontend
npm run dev
```

## Authentication and environment

Each user has a separate account (email + password). Transactions, portfolio positions, and budgets are scoped to the logged-in user.

Copy the backend env template and set a strong secret before starting the API:

```bash
cd backend
cp .env.example .env
```

Commit **`backend/.env.example`** to the repository (template only). Do **not** commit **`backend/.env`** — it contains secrets such as `JWT_SECRET`.

Required variables:

- `DATABASE_URL` — SQLite path (default `file:./dev.db`)
- `JWT_SECRET` — at least 32 characters (used to sign login tokens)

Register the first user via the frontend at `/register`, or call `POST /api/auth/register` with `{ "email", "password" }` (password minimum 8 characters).

### Demo data (optional)

Load sample transactions, portfolio, and budgets for a demo account:

```bash
cd backend
npm run db:seed
```

Login: `demo@finance.local` / `demo12345`

## Categories

Expense and income categories form a **tree** (parent → child). Each transaction should use a category from the list (`categoryId`); the API also stores the full path string (e.g. `FOOD > Restauracje`).

- Manage the tree on **Kategorie** (`/categories`).
- Charts roll up amounts to the **root** name (all `FOOD > …` expenses count as FOOD).
- Migrate legacy string-only rows: `cd backend && npm run db:migrate-categories`.

## Bank accounts

On **Konta** (`/accounts`) add a `BANK` account with opening balance. Link **INCOME** and **EXPENSE** transactions to that account so balances and net worth stay correct. The dashboard shows total **Konta bankowe** from net-worth stats.

## Budgets

On **Budżety** (`/budgets`) set monthly limits:

- Leave category empty for an overall monthly budget.
- Pick a **root expense category** (e.g. FOOD). Spending in subcategories (e.g. `FOOD > Restauracje`) counts toward that budget.

The dashboard shows progress (spent vs limit) for the month aligned with the selected period filter.

## Dashboard

The dashboard summarizes finances for a **selected period** (default: current month):

- Presets: current month, previous month, current quarter, current year, or a custom date range
- KPI cards: income, expenses, balance, and transaction count for the period; portfolio value is always current (as of today)
- Charts: cash flow over time (income vs expenses by month), expenses by category, income by category
- Budget progress uses the `YYYY-MM` from the range start

## Import CSV

Recommended flow: **Konta** (bank account) → **Kategorie** (optional default category) → **Import CSV** (`/import`).

1. Paste a bank statement export (mBank, ING, or generic PL headers).
2. Choose a **preset** (mBank / ING / Other) — column mapping fills automatically.
3. Select the target bank account and preview (up to 50 rows, income/expense totals).
4. Import — duplicate rows are skipped (`importHash` on date, amount, description, type).

Example headers:

| Bank | Date | Amount | Description |
|------|------|--------|-------------|
| mBank | `Data operacji` | `Kwota` | `Opis operacji` |
| ING | `Data transakcji` | `Kwota` | `Opis transakcji` |
| Generic | `Data` | `Kwota` | `Opis` |

**Broker import** (same page): map symbol, quantity, price, date columns and target portfolio — creates `PortfolioTrade` rows without auto cash transfer.

## Transactions and portfolio

- **Transakcje**: income and expenses with category from the tree and optional **bank account** (recommended when accounts exist). Filter by type, date range, and account.
- **Portfele inwestycyjne** (`/portfolios`): brokerage accounts, trades (BUY/SELL), transfers from cashflow.

## Database migrations

The backend uses Prisma + SQLite. The database file (`dev.db`) lives under `backend/`.

After changing models in `backend/prisma/schema.prisma`, run:

```bash
cd backend
npx prisma migrate dev --name <migration_description>
```

If a migration fails because old rows lack `userId`, reset the dev database (only when you do not need existing data):

```bash
cd backend
npx prisma migrate reset --force
```

## Build

```bash
npm run build
```

Builds the backend (TypeScript → JS) and the frontend (Vite build).
