# Testing and verification

Commands, coverage thresholds, test layout, and the checklist agents and contributors use before marking logic changes done.

Setup and quick commands: [README.md](../README.md#tests). PR workflow: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Commands

From the repo root:

```bash
npm test
npm run test:coverage
```

| Command | What it runs |
|---------|----------------|
| `npm test` | Backend unit/integration/HTTP tests, frontend tests, frontend lint |
| `npm run test:coverage` | Same tests with coverage reports and **enforced thresholds** |

Coverage HTML: `backend/coverage/index.html`, `frontend/coverage/index.html`.

## Coverage thresholds

| Package | Config | Lines | Branches | Functions | Statements |
|---------|--------|-------|----------|-----------|------------|
| Backend | `backend/.c8rc.json` | 85% | 75% | 88% | 85% |
| Frontend | `frontend/vitest.config.ts` | 85% | 70% | 80% | 85% |

Run `npm run test:coverage` when changing logic under paths counted toward those metrics.

### Frontend coverage scope

Metrics include only:

- `frontend/src/api/**/*.ts`
- `frontend/src/hooks/**/*.{ts,tsx}`
- `frontend/src/utils/**/*.ts`
- `frontend/src/state/period.tsx`

**Excluded:** pages, components, and other UI — new API logic must be tested in the scoped layers (especially `apiModules.test.ts`), not only in React components.

## Test pyramid

| Level | Where | Examples |
|-------|--------|----------|
| Unit | `backend/src/*.test.ts` | `transactionBalance.test.ts`, `marketData.test.ts` |
| Integration | `backend/test/*.integration.test.ts` | `accountValuation.integration.test.ts`, `marketData.integration.test.ts` |
| HTTP / workflow | `backend/test/app.http.test.ts` | auth, cross-user IDOR, brokerage cash, market-data status |
| Golden | `backend/test/golden.integration.test.ts` | ledger scenarios |
| Frontend unit | `frontend/src/**/*.test.ts` | `apiModules.test.ts`, `client.test.ts`, `useAsyncData.test.tsx`, `apiContracts.test.ts` |

Prioritize: money and balance rules, auth and tenancy, write flows that update derived state. Skip trivial UI snapshots unless they guard real behavior.

## Where to add tests

| Change | Add tests in |
|--------|----------------|
| New backend domain module | `backend/src/<name>.test.ts` |
| New or changed route / workflow | `backend/test/app.http.test.ts` and/or `backend/test/*.integration.test.ts` |
| New `frontend/src/api/<area>Api.ts` | `frontend/src/api/apiModules.test.ts` |
| New or changed JSON response shape | `frontend/src/api/apiContracts.test.ts` (+ fixtures under `api/fixtures/` when needed) |

## Verification checklist

Before marking work complete when logic under `backend/src/`, routes, or testable frontend layers changed:

1. `npm test` from repo root
2. `npm run test:coverage` — thresholds above must pass
3. New routes documented in [api.md](api.md); new API clients in [frontend.md](frontend.md) when applicable

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs three jobs:

1. **backend-test** — backend unit, integration, HTTP tests
2. **frontend-checks** — build, frontend tests, lint
3. **coverage** — backend (`c8`) and frontend (`vitest --coverage`) with threshold enforcement; uploads HTML/lcov artifacts

Backend tests preload `backend/test/setupTestEnv.ts` (via `tsx --import`) so CI gets an ephemeral SQLite `DATABASE_URL` and schema without `backend/.env`. Integration tests use `backend/test/prismaTestClient.ts` (`createTestPrisma`, `resetDatabase`). Tests run with `--test-concurrency=1` to avoid SQLite contention.

## Related docs

- [fullstack-architecture-practices.md](fullstack-architecture-practices.md) §10 — why tests are structured this way
- [AGENTS.md](../AGENTS.md) — recipes that reference this page
