# Fullstack review checklist

Use with [SKILL.md](SKILL.md). Map each item to a section in [docs/fullstack-architecture-practices.md](../../../docs/fullstack-architecture-practices.md).

## 1. Clear boundaries

- Are HTTP routes thin and domain logic extracted (`backend/src/routes/*`, domain modules in `backend/src/*.ts`)?
- Does the frontend avoid embedding transport details outside `frontend/src/api/client.ts`?
- Is it obvious where a new feature belongs?

## 2. Boring request flow

- Do handlers follow validate → auth → load → domain rule → serialize?
- Are parsing/serialization helpers shared (`routeSupport`, `toNumber`, `normalizeCurrency`)?
- Is request behavior centralized rather than duplicated across routes?

## 3. Stable API contracts

- Are endpoints under `/api/...` with consistent JSON and status codes?
- Does [docs/api.md](../../../docs/api.md) match implemented routes?
- Do frontend API types in `frontend/src/api/*.ts` match backend serializers?
- Are breaking shape differences documented or accidental?

## 4. Data model as source of truth

- Is [backend/prisma/schema.prisma](../../../backend/prisma/schema.prisma) aligned with [docs/domain.md](../../../docs/domain.md)?
- Are migrations present for schema changes?
- Are ledger/invariant fields enforced in backend code, not inferred in UI?

## 5. Domain rules in one place

- FX only in `backend/src/fx.ts`
- balances/lots only in dedicated modules (`transactionBalance`, `holdingLot`, `holdings`, `accountValuation`)
- no duplicated money/date/balance rules in frontend charts/tables

## 6. Auth and tenancy

- `requireAuth` on protected routes
- queries scoped by `userId`
- secrets only via env
- fail-closed unauthorized handling in backend and frontend client
- check for global/shared resources writable by any authenticated user

## 7. Centralized frontend data access

- one fetch/auth client
- domain API modules mirror backend areas
- components/pages not constructing raw URLs or auth headers ad hoc

## 8. Scoped frontend state

- global contexts limited to true cross-cutting concerns
- page/feature state not promoted globally without reason
- no parallel fetch/state patterns emerging unnecessarily

## 9. Pragmatic structure evolution

- modules extracted by domain pressure, not premature abstraction
- route files split when `backend/src/routes/` or page complexity grows
- avoid large "god" files returning after refactors

## 10. Tests and verification

- backend unit tests for pure domain logic (`backend/src/*.test.ts`)
- integration/HTTP/golden tests for workflows (`backend/test/`)
- frontend build covered in CI
- note frontend test/lint gaps explicitly

## 11. Documentation discipline

- `AGENTS.md` and `docs/*` index accurate
- doc drift called out when stale
- recipes for new routes/clients/docs still valid

## Repo-specific hot spots

Inspect these even if the general checklist passes:

| Area | Why |
|------|-----|
| Financial write flows | multi-step updates, derived balances, valuations |
| Stats/currency endpoints | frontend display currency vs backend conversion semantics |
| Holdings/lots/transactions | ledger chains, delete/update edge cases |
| Instruments/valuations | global vs user-owned data boundaries |
| Valuation recompute | performance and repeated DB work |
| `backend/src/routes/routeSupport.ts` | shared helpers becoming a hidden god module |
| Frontend page components | duplicated fetch/error/loading patterns |
| CI in `.github/workflows/ci.yml` | backend-only vs full-stack verification |

## Evidence to collect

For each finding, capture:
- file path(s)
- behavior observed
- why it violates or partially meets a practice
- suggested fix scope
- how to verify the fix
