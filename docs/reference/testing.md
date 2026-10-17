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
- Unit: `backend/src/**/*.test.ts` (auth, money, cash ledger CSV, statistics, http support).
- Integration / HTTP: `backend/test/*.test.ts` — `app.http.test.ts` (health + auth), `schema.integration.test.ts`, `migrateDeploy.test.ts`.
- Ephemeral SQLite: `prismaTestClient.ts` + `setupTestEnv.ts`.

### Coverage (c8)

From `backend/.c8rc.json`: lines/statements 85, branches 75, functions 88. Include `src/**/*.ts`; exclude `**/*.test.ts` and `src/scripts/**`.

## Frontend

- Vitest + jsdom: `frontend/src/**/*.test.ts(x)`.
- Current suites: `apiModules`, `apiContracts`, `client`, `format`, `useAsyncData`, `theme`, `AccountDetailPage`, `categoryScope`, `LedgerTable`, `StatisticsPage`, `AppShell`, `shellDrawerMode`.
- Lint: `cd frontend && npm run lint` runs ESLint (`--max-warnings 0`) then Stylelint (`npm run lint:css` on `src/**/*.css`, `--max-warnings 0`). Config: `frontend/stylelint.config.js` (extends `stylelint-config-standard`; hex colors only in `styles/tokens.css`; no `font-size` in `px`; no `!important`).

### Coverage (Vitest)

Include: `src/api/**/*.ts`, `src/hooks/**/*.{ts,tsx}`, `src/utils/**/*.ts`. Exclude fixtures and `*.test.*`. Thresholds: lines/statements 85, branches 70, functions 80.

New `*Api.ts` modules must extend `apiModules.test.ts`.

## CI

`.github/workflows/ci.yml` — Node 22, matching the production image. Backend job runs `npm run build` then `npm test`. Coverage job runs `npm run test:coverage`. Frontend lint is ESLint + Stylelint via `frontend` `npm run lint`. A `docker-build` job runs `docker build` and does not push the image.
