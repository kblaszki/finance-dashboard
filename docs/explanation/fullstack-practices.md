---
diataxis: explanation
use_when: Fullstack architecture principles illustrated with this repo
audience: both
related_docs:
  - docs/explanation/architecture.md
  - docs/meta/code-map.md
---

# Fullstack Architecture Practices

Hub: [docs/README.md](../README.md).

Practical habits for this monorepo. Examples match the **shipped** surface (auth, accounts, categories, tags, cash ledger, transfers, CSV import, statistics, NBP FX domain). Unshipped product intent stays in [mvp/](../../mvp/).

## 1. Clear boundaries

- Keep transport, domain logic, and persistence separate.
- Route handlers coordinate work; business rules live in `backend/src/domain/*`.
- Make it obvious where new logic belongs before adding code.

Wire-up: `backend/src/app.ts` → `routes/mountRouters.ts`. HTTP: `backend/src/routes/*` (auth, accounts, categories, tags, cashTransactions, csvImportPresets, categoryDescriptionRules, transfers, statistics). Shared helpers: `httpSupport.ts`, `routeSupport.ts`, `lib/errors.ts`. Money, FX, ledger, import, and stats rules stay in domain modules — not in handlers or the SPA.

## 2. Boring request flow

- Prefer: validate → authenticate → load owned row → apply domain rules → serialize.
- Use shared parsers and typed HTTP errors so handlers do not drift.

Use `httpSupport.ts` / `lib/errors.ts` (`HttpError`, `handleRouteError`, `badRequest`, …). Return **4xx** for client failures; reserve **500** for unexpected errors. See [architecture.md](architecture.md).

## 3. Stable API contracts

- Treat each endpoint as a contract between frontend and backend.
- Document routes in [api.md](../reference/api.md).
- Keep `frontend/src/api/*Api.ts` types aligned with backend JSON; cover new clients in `apiModules.test.ts`; grow `apiContracts` fixtures for high-churn DTOs (import preview, rules, transfers).

## 4. Data model as source of truth

- Structural truth lives in `backend/prisma/schema.prisma`.
- Every schema change gets a migration.
- Models and meaning: [domain.md](../reference/domain.md) (`User`, `Account`, `Category`, `CategoryDescriptionRule`, `Tag`, `CashTransaction`, `CashTransfer`, `CsvImportPreset`, `ImportBatch`, `FxRateDaily`, …).

## 5. Domain rules in one place

- Cash balance mutations: `domain/cashLedger.ts` (and transfers via `cashTransfers.ts`).
- FX conversion: `domain/fx.ts` / `fxRates.ts` / `nbpClient.ts` — not scattered in routes or UI.
- Import dedup, column map, description suggest: dedicated domain modules under `domain/`.
- Do not recompute money/date/balance rules in frontend charts beyond display formatting.

## 6. Auth and tenancy

- Protected routes use `requireAuth`; queries for user-owned rows filter by authenticated `userId` (or owned `accountId`).
- Cross-user access → `404` (not `403` leaking existence). Cover new user-scoped resources with HTTP IDOR tests.
- Secrets only via env; production guards in `authConfig.ts`.

## 7. Centralized frontend data access

- One fetch/auth client: `frontend/src/api/client.ts`.
- Domain clients mirror backend areas (`*Api.ts`); pages/components do not build URLs or auth headers ad hoc.
- No `fetch` outside `client.ts`.

## 8. Scoped frontend state

- Global contexts only for true cross-cutting concerns: auth, theme, currency (currency under AppShell).
- Prefer `useAsyncData` + stable loaders over ad-hoc global caches.
- Distinguish loading / error / empty in lists and charts.

## 9. Pragmatic structure evolution

- Extract modules by domain pressure, not premature abstraction.
- Split fat routers (e.g. cash import vs cash CRUD) when a file becomes a merge hotspot.
- Feature folders on the frontend only when a domain cluster stabilizes (import panels are a candidate).

## 10. Tests and verification

- Root `npm test` and `npm run test:coverage` — [testing.md](../reference/testing.md), [run-tests-and-coverage.md](../how-to/run-tests-and-coverage.md).
- HTTP suite is the primary contract/IDOR layer; domain unit tests cover pure helpers; frontend covers clients, hooks, and critical page flows.

## 11. Documentation discipline

- Significant API/schema/UI/auth/architecture changes update Diátaxis docs in the same logical commit (skill `docs-sync-during-work`).
- Keep [AGENTS.md](../../AGENTS.md), [code-map.md](../meta/code-map.md), and this file aligned with shipped routers/models.
- Product intent for unshipped features stays in `mvp/`, not as fake “done” rows in live reference docs.

## 12. Organize files by responsibility

- Backend: routes vs `domain/` vs `backend/test/`.
- Keep `routeSupport.ts` / `httpSupport.ts` free of financial rules.
- Frontend: `api/`, `pages/`, `components/`, `state/`, `hooks/` consistently.

## 13. Validate and serialize at boundaries

- Handlers use shared parsers; public JSON goes through serializers (major units, ISO dates).
- Multi-step writes that affect balances wrap in `prisma.$transaction`.
- Prefer re-checking invariants inside the write transaction when preview/commit are separate steps (e.g. import fingerprints).
