---
diataxis: reference
use_when: Test pyramid, coverage thresholds, CI facts
audience: both
related_docs:
  - docs/how-to/run-tests-and-coverage.md
---
# Testing and verification

Commands, coverage thresholds, test layout, and the checklist agents and contributors use before marking logic changes done.

Setup and quick commands: [README.md](../../README.md#tests). PR workflow: [CONTRIBUTING.md](../../CONTRIBUTING.md).

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

**Excluded:** pages, components, other UI, and `frontend/src/api/fixtures/**` — new API logic must be tested in the scoped layers (especially `apiModules.test.ts`), not only in React components.

## Test pyramid

| Level | Where | Examples |
|-------|--------|----------|
| Unit | `backend/src/**/*.test.ts` (excl. `*.integration.test.ts`) | `transactionBalance.test.ts`, `marketData/marketData.test.ts` |
| Integration | `backend/test/*.integration.test.ts` and `backend/src/**/*.integration.test.ts` | `accountValuation.integration.test.ts`, `tax/taxWrapper.integration.test.ts` |
| HTTP / workflow | `backend/test/app.http.test.ts` | auth, cross-user IDOR, brokerage cash, market-data status |
| Golden | `backend/test/golden.integration.test.ts` | ledger scenarios |
| Frontend unit | `frontend/src/**/*.test.ts` | `apiModules.test.ts`, `client.test.ts`, `useAsyncData.test.tsx`, `apiContracts.test.ts` |

Prioritize: money and balance rules, auth and tenancy, write flows that update derived state. Skip trivial UI snapshots unless they guard real behavior.

## Where to add tests

| Change | Add tests in |
|--------|----------------|
| New backend domain module | `backend/src/<name>.test.ts` or next to nested module (e.g. `marketData/*.test.ts`) |
| Domain integration | `backend/test/*.integration.test.ts` and/or `backend/src/**/*.integration.test.ts` |
| New or changed route / workflow | `backend/test/app.http.test.ts` and/or integration tests |
| New `frontend/src/api/<area>Api.ts` | `frontend/src/api/apiModules.test.ts` |
| New or changed JSON response shape | `frontend/src/api/apiContracts.test.ts` (+ fixtures under `api/fixtures/` when needed) |

## Verification checklist

Step-by-step gate: [how-to/run-tests-and-coverage.md](../how-to/run-tests-and-coverage.md). Thresholds and pyramid are above.

## CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs three jobs:

1. **backend-test** — backend unit, integration, HTTP tests
2. **frontend-checks** — build, frontend tests, lint
3. **coverage** — backend (`c8`) and frontend (`vitest --coverage`) with threshold enforcement; uploads HTML/lcov artifacts

Backend tests preload `backend/test/setupTestEnv.ts` (via `tsx --import`) so CI gets an ephemeral SQLite `DATABASE_URL` and schema without `backend/.env`. Integration tests use `backend/test/prismaTestClient.ts` (`createTestPrisma`, `resetDatabase`). Tests run with `--test-concurrency=1` to avoid SQLite contention.

## Related docs

- [how-to/run-tests-and-coverage.md](../how-to/run-tests-and-coverage.md) — step checklist
- [fullstack-practices.md](../explanation/fullstack-practices.md) §10 — why tests are structured this way
- [AGENTS.md](../../AGENTS.md) — docs index
- [docs hub](../README.md)
