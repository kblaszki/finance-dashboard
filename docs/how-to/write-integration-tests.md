---
diataxis: how-to
use_when: Add backend HTTP or integration tests
audience: agent
related_docs:
  - docs/reference/testing.md
  - docs/how-to/run-tests-and-coverage.md
related_code:
  - backend/test/app.http.test.ts
  - backend/test/prismaTestClient.ts
---

# Write integration and HTTP tests

Hub: [docs/README.md](../README.md).

Pyramid and thresholds: [testing.md](../reference/testing.md). Gate: [run-tests-and-coverage.md](run-tests-and-coverage.md).

## When to use which suite

| Need | Put it in |
|------|-----------|
| Pure helper / auth rule | `backend/src/**/*.test.ts` next to module |
| Schema uniqueness / migrate | `backend/test/schema.integration.test.ts`, `migrateDeploy.test.ts` |
| HTTP auth / health / route contract | `backend/test/app.http.test.ts` |

## Integration test setup

1. Use `createTestPrisma` / `resetDatabase` from `backend/test/prismaTestClient.ts` (`resetDatabase` clears `User`).
2. Env is preloaded via `setupTestEnv.ts` (ephemeral SQLite) — do not require `backend/.env`.
3. Tests run with `--test-concurrency=1` (SQLite).
4. For HTTP tests, set `JWT_SECRET` in `test.before` and import `app` from `backend/src/app.ts`.

## Frontend API coverage

New `frontend/src/api/*Api.ts` → extend `apiModules.test.ts` (and `apiContracts.test.ts` when response shapes change). See [testing.md](../reference/testing.md).

## Related

- [fullstack-practices.md](../explanation/fullstack-practices.md)
- CI: `.github/workflows/ci.yml`
