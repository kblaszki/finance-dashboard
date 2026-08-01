---
diataxis: explanation
use_when: Fullstack architecture principles illustrated with this repo
audience: both
related_docs:
  - docs/explanation/architecture.md
---

# Fullstack Architecture Practices

Hub: [docs/README.md](../README.md).

Practical habits for maintainable fullstack apps. Examples match the **auth baseline** in this repository; principles stay useful when features return from [mvp/](../../mvp/).

## 1. Start with clear boundaries

- Keep transport, domain logic, and persistence separate even in a small codebase.
- Let route handlers coordinate work, not own business rules.
- Make it obvious where a new piece of logic belongs before adding code.

Here, `backend/src/app.ts` wires the app; HTTP handlers live in `backend/src/routes/*` (today: `authRoutes.ts` via `mountRouters.ts`). Auth rules live in `backend/src/auth.ts` and `authConfig.ts`. Shared helpers: `httpSupport.ts`, `lib/errors.ts`.

When money, FX, or valuations appear, put them in dedicated domain modules — not in route handlers or the SPA.

## 2. Keep the request flow boring

- Prefer: validate → authenticate → load → apply rules → serialize.
- Use shared parsers and typed HTTP errors so handlers do not drift.

Use `httpSupport.ts` / `lib/errors.ts` (`HttpError`, `handleRouteError`, `badRequest`, …). Return **4xx** for client failures; reserve **500** for unexpected errors.

See [architecture.md](architecture.md).

## 3. Design APIs as stable contracts

- Treat each endpoint as a contract between frontend and backend.
- Document routes in [api.md](../reference/api.md).
- Keep `frontend/src/api/*Api.ts` types aligned with backend JSON; cover new clients in `apiModules.test.ts`.

Today the surface is health + auth. Expand the catalog when adding routes (skill `docs-sync-during-work`).

## 4. Make the data model the source of truth

- Structural truth lives in `backend/prisma/schema.prisma`.
- Every schema change gets a migration.
- Current model: [domain.md](../reference/domain.md) (`User` only).

## 5. Prefer explicit tenancy

- User-owned rows must be scoped by authenticated `userId`.
- Today only `User` exists; when accounts/transactions return, filter by `userId` on every query and reject cross-user access with 404.

## 6. Keep the frontend thin

- Pages and components call `*Api.ts`; auth session lives in `state/auth.tsx`.
- HTTP details stay in `client.ts` (token, 401 handler).
- Prefer small loaders (`useAsyncData`) over ad-hoc global caches unless the team chooses otherwise.

## 7. Verify with tests and coverage

- Root `npm test` and `npm run test:coverage` — [testing.md](../reference/testing.md), [run-tests-and-coverage.md](../how-to/run-tests-and-coverage.md).

## 8. Document in the same chunk

- Significant API/schema/UI/auth changes update Diátaxis docs in the same logical commit (skill `docs-sync-during-work`).
- Product intent for unshipped features stays in `mvp/`, not as fake “done” rows in live reference docs.

## 9. Operational hygiene

- Secrets only in `.env` (never commit).
- Private deploy: `ALLOW_REGISTER=false` + `create-user` — [private-deploy.md](../how-to/private-deploy.md).
- Backups: `npm run db:backup`.
