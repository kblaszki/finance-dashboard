# Finance Dashboard

A full-stack app for tracking personal finances: bank accounts, brokerage positions, and manual assets (e.g. real estate). Built with:

- **Backend:** Node.js + TypeScript + Express + Prisma + SQLite
- **Frontend:** Vite + React + TypeScript

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

- Backend: `http://localhost:4000`
- Frontend: `http://localhost:5173`

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

Each user has a separate account (`email`, `username`, `password`). All accounts, transactions, and positions are scoped to the logged-in user.

Copy the backend env template and set a strong secret before starting the API:

```bash
cd backend
cp .env.example .env
```

Commit **`backend/.env.example`** to the repository (template only). Do **not** commit **`backend/.env`** — it contains secrets such as `JWT_SECRET`.

Required variables:

- `DATABASE_URL` — SQLite path (default `file:./dev.db`)
- `JWT_SECRET` — at least 32 characters (used to sign login tokens)

Optional (reserved for future market data integration):

- `MARKET_DATA_API_KEY` — see `.env.example`

Register via the frontend at `/register`, or call `POST /api/auth/register` with `{ "email", "username", "password" }` (password minimum 8 characters).

## Demo data (optional)

Load sample data for a demo user:

```bash
cd backend
npm run db:seed
```

Login: `demo@finance.local` / `demo12345` (username: `demo`)

The seed creates four accounts: PLN bank (~90 days of transactions), USD brokerage (AAPL, VT), EUR brokerage (IWDA), and a MANUAL property account. See `plans/baza_danych/07-dane-demo.md` if available locally.

## Tests

From the project root:

```bash
npm test
```

Runs backend unit, integration, and HTTP tests (`backend/src/**/*.test.ts`, `backend/test/**/*.test.ts`).

Coverage reports (HTML + terminal summary):

```bash
npm run test:coverage
```

Open `backend/coverage/index.html` and `frontend/coverage/index.html` in a browser.

## Account types

| Type | Purpose |
|------|---------|
| **BANK** | Cash transactions (income, expense, transfers); balance history from `Transaction.balanceAfter` |
| **BROKERAGE** | Cash plus securities via BUY/SELL **holding lots**; charts from daily valuations |
| **MANUAL** | Tracked value without lots (e.g. real estate estimate) |

Manage accounts on **Accounts** (`/accounts`). Open an account for transaction history (bank) or lots and position charts (brokerage).

## Transactions

On **Transactions** (`/transactions`): list and filter income/expense/transfer rows. Each transaction has a **category** string (free text, e.g. `SALARY`, `FOOD`) — there is no category tree in the MVP.

Link transactions to a **BANK** or **BROKERAGE** account so `cashBalance` and charts stay correct.

## Dashboard

The dashboard summarizes finances for a **selected period** (default: current month):

- Presets: current month, previous month, current quarter, current year, or a custom date range
- KPI cards: income, expenses, balance, transaction count for the period; net worth from latest account valuations
- Charts: cash flow over time, expenses by category, income by category

## Database migrations

The backend uses Prisma + SQLite. The database file (`dev.db`) lives under `backend/`.

After changing models in `backend/prisma/schema.prisma`:

```bash
cd backend
npx prisma migrate dev --name <migration_description>
```

To reset the dev database (only when you do not need existing data):

```bash
cd backend
npx prisma migrate reset --force
```

Or push schema without migration history:

```bash
cd backend
npx prisma db push --force-reset
npm run db:seed
```

## Build

```bash
npm run build
```

Builds the backend (TypeScript to JS) and the frontend (Vite production bundle).

## Further documentation

- [docs/architecture.md](docs/architecture.md) — auth, FX, module layout
- [docs/api.md](docs/api.md) — REST route catalog
- [docs/domain.md](docs/domain.md) — Prisma models
- [docs/frontend.md](docs/frontend.md) — UI routes and API clients
- [AGENTS.md](AGENTS.md) — agent-oriented index
