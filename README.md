# Finance Dashboard

Personal full-stack finance app (auth baseline today; more domains tracked in [mvp/CHECKLIST.md](mvp/CHECKLIST.md)). Built with:

- **Backend:** Node.js + TypeScript + Express + Prisma + SQLite
- **Frontend:** Vite + React + TypeScript

**Current code:** register/login (JWT), profile / email / password settings, multi-type accounts, cash ledger with categories, month statistics, health check, and a demo user with sample portfolio data. Broader portfolio/tax features remain in [mvp/CHECKLIST.md](mvp/CHECKLIST.md).

## Requirements

- Node.js 20+ (CI tests on Node 24)
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

Each user has `email`, `username`, and `passwordHash`. Copy the backend env template and set a strong secret before starting the API:

```bash
cd backend
cp .env.example .env
```

Commit **`backend/.env.example`** (template only). Do **not** commit **`backend/.env`**.

Required variables:

- `DATABASE_URL` — SQLite path (default `file:./dev.db`)
- `JWT_SECRET` — at least 32 characters (used to sign login tokens)

Optional: `ALLOW_REGISTER`, `CORS_ORIGIN`, `JSON_BODY_LIMIT`, backup vars — see [docs/reference/environment.md](docs/reference/environment.md).

Register via the frontend at `/register`, or call `POST /api/auth/register` with `{ "email", "username", "password" }` (password minimum 8 characters). After login you land on **Dashboard** (`/dashboard`); manage profile under **Settings**.

For a **private single-user deployment**, set `ALLOW_REGISTER=false` in `backend/.env` and create the account with `npm run create-user` — see [Private deployment](#private-deployment) below.

## Private deployment

For running as a personal instance (not open registration):

1. **Lock registration** — in `backend/.env`:
   ```env
   ALLOW_REGISTER=false
   ```
2. **Create your user** (CLI):
   ```bash
   cd backend
   npm run create-user -- --email you@example.com --username you --password 'your-password'
   ```
3. **Daily SQLite backup**:
   ```bash
   cd backend
   npm run db:backup
   ```
   Files land in `backend/backups/` (`finance-YYYYMMDD-HHmm.db`). Add `--gzip` or set `BACKUP_GZIP=true` to compress. Sync that folder off-site manually.

   Windows Task Scheduler / cron example:
   ```bash
   0 2 * * * cd /path/to/finance-dashboard/backend && npm run db:backup
   ```

4. **Health check** — `GET /api/health` returns `{ ok: true, db: true }`.

5. **Docker** (optional home server):
   ```bash
   cp backend/.env.production.example backend/.env
   # edit JWT_SECRET
   docker compose up -d --build
   docker compose exec api npm run create-user -- --email you@example.com --username you --password 'secret'
   ```
   UI: `http://localhost:8080` (nginx proxies `/api` to the backend). Database and backups persist in `./data/`.

Full checklist: [docs/how-to/private-deploy.md](docs/how-to/private-deploy.md).

## Demo user (optional)

Upserts the demo login and **replaces** that user’s sample portfolio (accounts, categories, cash txs). Re-run wipes all demo-owned data:

```bash
cd backend
npm run db:seed
```

Login: `demo@finance.local` / `demo12345` (username: `demo`). Walkthrough: [docs/tutorials/demo-seed.md](docs/tutorials/demo-seed.md).

## Tests

From the project root:

```bash
npm test
```

Runs backend tests, frontend tests, and frontend lint.

Coverage reports (HTML + terminal summary):

```bash
npm run test:coverage
```

Open `backend/coverage/index.html` and `frontend/coverage/index.html` in a browser.

Coverage thresholds are enforced in [`backend/.c8rc.json`](backend/.c8rc.json) and [`frontend/vitest.config.ts`](frontend/vitest.config.ts). Frontend metrics include `src/api/`, `src/hooks/`, and `src/utils/` (UI pages excluded).

Details: [docs/reference/testing.md](docs/reference/testing.md); [docs/how-to/run-tests-and-coverage.md](docs/how-to/run-tests-and-coverage.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for fork/branch/PR workflow and project conventions.

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

Then optionally:

```bash
npm run db:seed
```

## Build

```bash
npm run build
```

Builds the backend (TypeScript to JS) and the frontend (Vite production bundle).

## Further documentation

- [docs/README.md](docs/README.md) — Diátaxis documentation hub
- [docs/explanation/architecture.md](docs/explanation/architecture.md) — auth and request flow
- [docs/reference/api.md](docs/reference/api.md) — REST route catalog
- [docs/reference/domain.md](docs/reference/domain.md) — Prisma models
- [docs/reference/frontend.md](docs/reference/frontend.md) — UI routes and API clients
- [docs/tutorials/first-run.md](docs/tutorials/first-run.md) — first local success
- [mvp/CHECKLIST.md](mvp/CHECKLIST.md) — product backlog
- [AGENTS.md](AGENTS.md) — agent-oriented index
