---
diataxis: how-to
use_when: Add golden fixtures or backend integration tests
audience: agent
related_docs:
  - docs/reference/testing.md
  - docs/how-to/run-tests-and-coverage.md
related_code:
  - backend/test/helpers/seedFromFixture.ts
  - backend/test/golden.integration.test.ts
  - backend/test/prismaTestClient.ts
---

# Write integration and golden tests

Hub: [docs/README.md](../README.md).

Pyramid and thresholds: [testing.md](../reference/testing.md). Gate: [run-tests-and-coverage.md](run-tests-and-coverage.md).

## When to use which suite

| Need | Put it in |
|------|-----------|
| Pure domain rule | `backend/src/**/*.test.ts` next to module |
| Multi-step DB workflow | `backend/test/*.integration.test.ts` or co-located `*.integration.test.ts` under `src/` |
| HTTP auth/IDOR/route contract | `backend/test/app.http.test.ts` |
| Ledger golden scenarios | `backend/test/golden.integration.test.ts` + JSON fixture |
| Broader phase regressions | `phaseC.integration.test.ts`, `phaseD.integration.test.ts` (extend carefully) |

## Golden fixtures

1. Add `backend/test/fixtures/golden-<name>.json` with `user`, `accounts`, `instruments`, `transactions`, `holdingLots`, etc. (see existing goldens).
2. Load via `seedFromFixture(prisma, fixture)` from `backend/test/helpers/seedFromFixture.ts` — creates user, accounts, lots, backfills valuations; uses `MOCK_FX` for conversions.
3. Register the filename in the list inside `golden.integration.test.ts`.
4. Assert balances / valuations / P&amp;L against expected numbers in the test body.

Keep fixtures deterministic (fixed dates, explicit prices). Prefer small scenarios over cloning the demo seed.

## Integration test setup

1. Use `createTestPrisma` / `resetDatabase` from `backend/test/prismaTestClient.ts`.
2. Env is preloaded via `setupTestEnv.ts` (ephemeral SQLite) — do not require `backend/.env`.
3. Tests run with `--test-concurrency=1` (SQLite).
4. For FX-dependent paths, import `MOCK_FX` from `seedFromFixture` or call domain with explicit `plnPerUnit`.

## Frontend API coverage

New `frontend/src/api/*Api.ts` → extend `apiModules.test.ts` (and `apiContracts.test.ts` when response shapes change). See [testing.md](../reference/testing.md) frontend scope.

## Related

- [fullstack-practices.md](../explanation/fullstack-practices.md) §10
- CI: three jobs in `.github/workflows/ci.yml` (Node 24)
