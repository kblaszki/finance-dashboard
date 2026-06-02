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

## Budgets

On the **Budżety** page you can set monthly spending limits:

- Leave **category** empty for an overall monthly budget.
- Set a category name (e.g. `FOOD`) to track spending in that category only.

The dashboard shows progress (spent vs limit) for the month aligned with the selected period filter.

## Dashboard

The dashboard summarizes finances for a **selected period** (default: current month):

- Presets: current month, previous month, current quarter, current year, or a custom date range
- KPI cards: income, expenses, balance, and transaction count for the period; portfolio value is always current (as of today)
- Charts: cash flow over time (income vs expenses by month), expenses by category, income by category
- Budget progress uses the `YYYY-MM` from the range start

## Transactions and portfolio

- **Transakcje**: add, edit, and delete income and expense entries (category, description, date, currency). Filter the list by type and date range.
- **Portfel**: add investment positions (symbol, quantity, buy/current price, currency) without creating a cash transaction.

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
