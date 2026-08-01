---
diataxis: how-to
use_when: Add a new REST API endpoint end-to-end
audience: agent
related_docs:
  - docs/reference/api.md
  - docs/reference/testing.md
related_code:
  - backend/src/routes/
  - frontend/src/api/
---

# Add an API endpoint

Hub: [docs/README.md](../README.md).

1. Handler in `backend/src/routes/<area>Routes.ts`; wire in `backend/src/routes/mountRouters.ts` (see existing `createAuthRouter` pattern). Use `requireAuth` / `uid` for protected routes; parse and throw via `httpSupport` / `lib/errors`.
2. Client in `frontend/src/api/<area>Api.ts` using `apiClient`.
3. One row in [docs/reference/api.md](../reference/api.md).
4. Tests — [run-tests-and-coverage.md](run-tests-and-coverage.md) and [testing.md](../reference/testing.md) (HTTP cases in `app.http.test.ts` + `apiModules.test.ts` when adding a frontend client).
5. Significant changes: skill `docs-sync-during-work` in the same commit chunk.

Domain money/FX rules (when those modules exist) belong in dedicated backend files, not in route handlers.
