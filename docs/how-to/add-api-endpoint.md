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

1. Handler in `backend/src/routes/<area>Routes.ts` (wire in `backend/src/app.ts` / `mountRouters.ts`; match `requireAuth`, `userId`, `toNumber`, `normalizeCurrency` from `fx.ts`).
2. Client in `frontend/src/api/<area>Api.ts`.
3. One row in [docs/reference/api.md](../reference/api.md).
4. Tests — [docs/how-to/run-tests-and-coverage.md](run-tests-and-coverage.md) and [docs/reference/testing.md](../reference/testing.md) (HTTP/integration + `apiModules.test.ts`).
5. If the change is significant, follow skill `docs-sync-during-work` in the same commit chunk.
