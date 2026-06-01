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

## Database migrations

The backend uses Prisma + SQLite. The database file (`dev.db`) lives under `backend/`.

After changing models in `backend/prisma/schema.prisma`, run:

```bash
cd backend
npx prisma migrate dev --name <migration_description>
```

## Build

```bash
npm run build
```

Builds the backend (TypeScript → JS) and the frontend (Vite build).
