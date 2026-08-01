---
diataxis: meta
use_when: Locate primary code paths for auth baseline modules
audience: agent
related_docs:
  - docs/README.md
  - docs/explanation/architecture.md
---

# Code map

Hub: [docs/README.md](../README.md).

Auth-only baseline — product backlog paths live under [mvp/](../../mvp/), not here.

| Area | Primary paths |
|------|----------------|
| Express app / health | `backend/src/app.ts` |
| JWT auth helpers | `backend/src/auth.ts`, `backend/src/authConfig.ts` |
| Auth HTTP routes | `backend/src/routes/authRoutes.ts` |
| Router mount | `backend/src/routes/mountRouters.ts` |
| HTTP helpers / errors | `backend/src/routes/httpSupport.ts`, `backend/src/lib/errors.ts` |
| Route uid helper | `backend/src/routes/routeSupport.ts` |
| Prisma schema | `backend/prisma/schema.prisma` (`User` only) |
| Migrations | `backend/prisma/migrations/` |
| Demo user seed | `backend/prisma/seed.ts` |
| Create user CLI | `backend/src/scripts/createUser.ts` |
| DB backup CLI | `backend/src/scripts/backupDb.ts` |
| SQLite path helper | `backend/src/dbPath.ts` |
| HTTP / schema tests | `backend/test/app.http.test.ts`, `schema.integration.test.ts`, `migrateDeploy.test.ts` |
| Test Prisma helper | `backend/test/prismaTestClient.ts`, `setupTestEnv.ts` |
| SPA routes | `frontend/src/App.tsx` |
| Auth state | `frontend/src/state/auth.tsx` |
| Auth API client | `frontend/src/api/authApi.ts`, `frontend/src/api/client.ts` |
| Shell / gates | `frontend/src/components/AppShell.tsx`, `ProtectedRoute.tsx` |
| Pages | `frontend/src/pages/{Landing,Login,Register,Home,Settings}Page.tsx` |
| Theme | `frontend/src/state/theme.tsx`, `ThemeToggle.tsx` |
