# Fullstack review checklist

Use with [SKILL.md](SKILL.md). Map each item to a section in [docs/fullstack-architecture-practices.md](../../../docs/fullstack-architecture-practices.md).

## 1. Clear boundaries

- Are HTTP routes thin and domain logic extracted (`backend/src/routes/*`, domain modules in `backend/src/*.ts`)?
- Does `routeSupport.ts` stay limited to serialization and tenancy helpers (financial rules in domain modules such as `accountValuation.ts`)?
- Does the frontend avoid embedding transport details outside `frontend/src/api/client.ts`?
- Is it obvious where a new feature belongs?

## 2. Boring request flow

- Do handlers follow validate → auth → load → domain rule → serialize?
- Are parsing/serialization helpers shared (`httpSupport`, `routeSupport`, `toNumber`, `normalizeCurrency`)?
- Is request behavior centralized rather than duplicated across routes?
- Do validation failures use `HttpError` (4xx) and unexpected failures map to 500 via `handleRouteError`?

## 3. Stable API contracts

- Are endpoints under `/api/...` with consistent JSON and status codes?
- Does [docs/api.md](../../../docs/api.md) match implemented routes (including `backend/src/routes/*`)?
- Do frontend API types in `frontend/src/api/*.ts` match backend serializers?
- Are all public endpoints serialized (no raw Prisma rows with inconsistent Decimal shapes)?
- Are shared vs user-scoped resources documented (`Instrument` global vs accounts per `userId`)?

## 4. Data model as source of truth

- Is [backend/prisma/schema.prisma](../../../backend/prisma/schema.prisma) aligned with [docs/domain.md](../../../docs/domain.md)?
- Are migrations present for schema changes?
- Are ledger/invariant fields enforced in backend code, not inferred in UI?

## 5. Domain rules in one place

- FX only in `backend/src/fx.ts`
- balances/lots/cash replay only in dedicated modules (`transactionBalance`, `holdingLot`, `holdings`, `accountValuation`)
- no duplicated money/date/balance rules in frontend charts/tables

## 6. Auth and tenancy

- `requireAuth` on protected routes
- queries scoped by `userId` for user-owned models
- secrets only via env
- fail-closed unauthorized handling in backend and frontend client
- global/shared resources explicitly documented and reviewed (instruments catalog)

## 7. Centralized frontend data access

- one fetch/auth client
- domain API modules mirror backend areas (including instrument valuations if exposed)
- components/pages not constructing raw URLs or auth headers ad hoc

## 8. Scoped frontend state

- global contexts limited to true cross-cutting concerns
- page/feature state not promoted globally without reason
- preferred async pattern: `useAsyncData` + feature providers where shared loading is needed
- loading / error / empty distinguished in charts and lists
- no parallel fetch/state patterns emerging unnecessarily

## 9. Pragmatic structure evolution

- modules extracted by domain pressure, not premature abstraction
- route files split under `backend/src/routes/` when areas grow
- avoid large "god" files returning after refactors (`routeSupport`, monolithic handlers)
- feature folders on frontend only when a domain justifies them

## 10. Tests and verification

- backend unit tests for pure domain logic (`backend/src/*.test.ts`)
- integration tests for domain + Prisma (`backend/test/*.integration.test.ts`)
- HTTP tests for auth, tenancy, and critical write paths (`backend/test/app.http.test.ts`)
- golden fixtures for ledger/financial workflows (`backend/test/golden.integration.test.ts`)
- frontend unit tests for cross-cutting client and hooks (`client.test.ts`, `useAsyncData.test.tsx`)
- CI: backend tests + frontend build + test + lint (`.github/workflows/ci.yml`)
- cross-user IDOR checks for user-owned resources where HTTP coverage exists
- note gaps explicitly (E2E, component coverage) without treating them as blockers for hobby scale

## 11. Documentation discipline

- `AGENTS.md` and `docs/*` index accurate
- [fullstack-architecture-practices.md](../../../docs/fullstack-architecture-practices.md) matches current `routes/*` layout
- doc drift called out when stale
- recipes for new routes/clients/docs still valid

## 12. Organize files by responsibility

- new backend code lands in routes vs domain vs `backend/test/` appropriately
- `routeSupport.ts` not growing domain/financial logic
- new frontend code uses `api/`, `pages/`, `components/`, `state/`, `hooks/` consistently
- no stray `fetch` outside `frontend/src/api/`

## 13. Validate and serialize at boundaries

- handlers use `httpSupport` parsers consistently (not raw `Number()` on bodies)
- serializers on public JSON responses
- frontend types aligned with backend shapes
- multi-step writes that affect invariants wrapped in `prisma.$transaction`
- instrument valuation and similar paths atomic where partial failure leaves bad state

## Repo-specific hot spots

Inspect these even if the general checklist passes:

| Area | Why |
|------|-----|
| Financial write flows | multi-step updates, derived balances, valuations |
| `accountValuation.ts` | cash replay, recalc after transaction/lot changes |
| Stats/currency endpoints | frontend display currency vs backend conversion semantics |
| Holdings/lots/transactions | ledger chains, delete/update edge cases, brokerage cash sync |
| Instruments/valuations | global catalog vs user-owned data boundaries |
| Valuation recompute | performance and repeated DB work |
| `backend/src/routes/httpSupport.ts` | error status mapping, shared parsers |
| `backend/src/routes/routeSupport.ts` | shared helpers becoming a hidden god module |
| Frontend async patterns | `useAsyncData.ts`, dashboard charts, duplicated `useEffect` loads |
| Frontend page components | duplicated fetch/error/loading patterns |
| CI in `.github/workflows/ci.yml` | backend tests, frontend build/test/lint |

## Evidence to collect

For each finding, capture:
- file path(s)
- behavior observed
- why it violates or partially meets a practice (section 1–13)
- suggested fix scope
- how to verify the fix
