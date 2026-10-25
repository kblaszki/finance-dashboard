---
diataxis: reference
use_when: Test pyramid, coverage thresholds, CI
audience: both
related_docs:
  - docs/how-to/run-tests-and-coverage.md
related_code:
  - backend/.c8rc.json
  - frontend/vitest.config.ts
  - .github/workflows/ci.yml
---

# Testing reference

Hub: [docs/README.md](../README.md). Checklist: [run-tests-and-coverage.md](../how-to/run-tests-and-coverage.md).

## Commands (repo root)

| Command | What |
|---------|------|
| `npm test` | Backend tests → frontend Vitest → frontend lint (ESLint + Stylelint) |
| `npm run test:coverage` | Backend c8 + frontend Vitest coverage |

## Backend

- Runner: Node test via `tsx` (`backend/package.json`), concurrency 1.
- Unit: `backend/src/**/*.test.ts` — auth, money, cash ledger/CSV/import/dedup/suggest, transfers, categories, tags, FX/NBP, statistics domains, http/route support.
- Integration / HTTP: `backend/test/*.test.ts`.
  - Shared harness: `httpHarness.ts` (`startHttpSuite`, `registerAndLogin`, …).
  - `auth.http.test.ts` — health + auth contract tests (split from the monolith).
  - Domain HTTP suites via `httpHarness.ts` — **contract + IDOR** split by area: `accounts.http.test.ts`, `ledgerImport.http.test.ts`, `categories.http.test.ts`, `transfers.http.test.ts`, `statistics.http.test.ts` (plus `auth.http.test.ts` for auth/health). New user-scoped resources should add foreign-user `404` cases in the matching suite.
  - `schema.integration.test.ts`, `migrateDeploy.test.ts`.
- Soft row caps (`domain/rowCaps.ts`: export 50k, balance-history 100k, stats period 50k, month-list 2000) plus import fingerprint scan limits (50k) that fail closed on overflow → `400` (documented in [api.md](api.md)).
- Ephemeral SQLite: `prismaTestClient.ts` + `setupTestEnv.ts`.

### Scale work deferred (do not start without a signal)

| Deferred | Trigger to revisit |
|----------|-------------------|
| SQL / Prisma `groupBy` (or equivalent) for statistics aggregation | Soft caps (`STATS_PERIOD_ROW_CAP`, etc.) start failing for real users, or period loads are too slow under hobby volume |
| Playwright (or similar) E2E | Multi-page regressions escape Vitest page tests; not justified for hobby single-user flows today |

Until then: keep in-process aggregation behind soft caps, and rely on HTTP + Vitest page/component tests.

### Coverage (c8)

From `backend/.c8rc.json`: lines/statements 85, branches 75, functions 88. Include `src/**/*.ts`; exclude `**/*.test.ts` and `src/scripts/**`.

## Frontend

- Vitest + jsdom: `frontend/src/**/*.test.ts(x)`.
- Suites include: `apiModules`, `apiContracts`, `client`, hooks (`useAsyncData`), utils, `AccountDetailPage`, `CategoriesPage`, `TransfersPage`, `StatisticsPage`, `TagsPage`, `AccountsPage`, `AppShell`, ledger components, theme.
- Lint: `cd frontend && npm run lint` runs ESLint (`--max-warnings 0`) then Stylelint (`npm run lint:css` on `src/**/*.css`, `--max-warnings 0`). Config: `frontend/stylelint.config.js` (extends `stylelint-config-standard`; hex colors only in `styles/tokens.css`; no `font-size` in `px`; no `!important`).
- **No E2E** (Playwright/Cypress) by design at hobby scale; page tests cover critical import/ledger flows. See **Scale work deferred** above.

### Coverage (Vitest)

Include: `src/api/**/*.ts`, `src/hooks/**/*.{ts,tsx}`, `src/utils/**/*.ts`. Exclude fixtures and `*.test.*`. Thresholds: lines/statements 85, branches 70, functions 80. Pages/components are not in the coverage gate — protect them with page tests.

New `*Api.ts` modules must extend `apiModules.test.ts`. High-churn DTOs should extend `apiContracts` fixtures.

## CI

`.github/workflows/ci.yml` — Node 22, matching the production image.

| Job | What |
|-----|------|
| `backend-test` | `prisma generate`, `npm run build`, `npm test` in `backend/` |
| `frontend-checks` | `npm run build`, `npm test`, `npm run lint` in `frontend/` |
| `coverage` | Per-package `npm run test:coverage` (same thresholds as root script) |
| `docker-build` | `docker build` (does not push) |
