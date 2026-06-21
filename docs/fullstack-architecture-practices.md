# Fullstack Architecture Practices

This guide captures practical habits for building maintainable fullstack applications. It focuses on architectural decisions that keep backend, frontend, and data model changes understandable as the product grows.

The examples in this document use patterns from this repository, but the principles are intentionally general. Use this page for architectural guidance, then follow the linked project docs for the current implementation details.

## 1. Start with clear boundaries

- Keep transport, domain logic, and persistence separate even in a small codebase.
- Let route handlers coordinate work, not own business rules.
- Make it obvious where a new piece of logic belongs before adding code.

In this repository, `backend/src/app.ts` wires routers; HTTP handlers live in `backend/src/routes/*`, while reusable domain logic lives in modules such as `backend/src/fx.ts`, `backend/src/accountValuation.ts`, `backend/src/holdingLot.ts`, `backend/src/transactionBalance.ts`, and `backend/src/netWorth.ts`.

Shared route helpers in `backend/src/routes/routeSupport.ts` cover serialization and tenancy lookups. Financial rules such as cash recalc and valuation replay belong in domain modules (for example `accountValuation.ts`), not in route support.

## 2. Keep the request flow boring

- Prefer a predictable request path: validate input, authenticate, load data, apply domain rules, serialize the response.
- Use shared helpers for parsing and serialization so handlers do not drift apart.
- Keep the number of places that can mutate request behavior small.

Use parsers and typed HTTP errors from `backend/src/routes/httpSupport.ts` (`parseRequiredString`, `parseFiniteNumber`, `HttpError`, `handleRouteError`). Return **4xx** for validation and authorization failures via `HttpError`; reserve **500** for unexpected server failures. Do not throw generic `Error` in handlers when you mean a client-facing 404 or 400.

For the current request flow and layer map, see [architecture.md](architecture.md).

## 3. Design APIs as stable contracts

- Treat each endpoint as a contract between frontend and backend, not just a convenient function call.
- Use consistent JSON shapes, meaningful status codes, and clear resource naming.
- Put public application endpoints under a stable namespace such as `/api/...`.
- Document routes in a concise catalog so contributors know where to extend the surface area.

In this repository, REST handlers live under `/api/...` and are documented in [api.md](api.md). Serializers in `routeSupport.ts` (`serializeAccount`, `serializeInstrument`, and others) keep JSON consistent, especially numeric fields from Prisma `Decimal`. Types in `frontend/src/api/*.ts` should match backend responses; without codegen, keep them aligned through discipline and tests such as `frontend/src/api/client.test.ts`.

Not every resource is user-scoped: accounts, transactions, and holdings are filtered by `userId`, while the `Instrument` catalog is shared globally. Document shared vs tenant-scoped models in [architecture.md](architecture.md) and [domain.md](domain.md).

## 4. Make the data model the source of truth

- Put structural truth in the schema, not in scattered UI assumptions.
- Create a migration for every schema change so data evolution is explicit and reproducible.
- Keep derived values and invariants enforced in backend code close to the models they affect.

Here, the source of truth is `backend/prisma/schema.prisma`, with entity-level documentation in [domain.md](domain.md). Ledger-style invariants such as running balances and holding quantities are maintained in backend modules rather than inferred in the frontend.

## 5. Put domain rules in one place

- Shared rules should have a single implementation, especially for money, dates, pricing, and balances.
- Avoid copying the same business rule into route handlers, charts, and UI tables.
- If a rule is important enough to mention in docs, it is important enough to centralize in code.

This repository already follows that pattern for FX conversion in `backend/src/fx.ts`, holding lot behavior in `backend/src/holdingLot.ts`, transaction balance calculations in `backend/src/transactionBalance.ts`, and cash replay in `backend/src/accountValuation.ts`.

## 6. Build auth and tenancy into the architecture

- Authenticate once at the edge, then pass trusted identity through the request lifecycle.
- Authorize every data access with explicit tenant or user scoping where the model is user-owned.
- Keep secrets in environment variables only, and never couple local development convenience with production security.
- Fail closed when auth state is missing or invalid.

In this repository, `backend/src/auth.ts` provides JWT handling and `requireAuth`, while user-owned queries are scoped by `userId`. The frontend centralizes token handling in `frontend/src/api/client.ts`. Global resources (such as instruments) require an explicit product decision and documentation in [domain.md](domain.md) and [api.md](api.md), not an assumption that every table has `userId`.

## 7. Keep frontend data access centralized

- UI components should render state, not know how authentication headers or base URLs work.
- Use a shared client for cross-cutting concerns such as auth headers, error handling, and request defaults.
- Group API calls by domain area so the frontend mirrors the backend's public surface.

In this repository, low-level request behavior lives in `frontend/src/api/client.ts`, while feature-oriented modules under `frontend/src/api/` expose domain-specific calls.

## 8. Scope frontend state intentionally

- Keep global state small and reserved for truly shared concerns.
- Prefer page-level or feature-level state when only one workflow needs it.
- Do not introduce parallel state patterns unless the current one is clearly failing.

Examples here include shared contexts for auth, currency, and theme under `frontend/src/state/`, with routing defined in `frontend/src/App.tsx`. For dashboard data, prefer `frontend/src/hooks/useAsyncData.ts` with a feature provider (for example `frontend/src/state/cashflow.tsx`) over ad-hoc `useEffect` chains. Components should distinguish **loading**, **error**, and **empty** states, especially charts and lists.

For the current route map, see [frontend.md](frontend.md).

## 9. Let structure evolve with real pressure

- Start with the simplest structure that keeps responsibilities clear.
- Extract modules when repeated patterns or growing complexity create real maintenance cost.
- Split by domain boundary before adding abstractions for their own sake.

In this repository, `app.ts` wires domain routers under `backend/src/routes/`, with shared `routeSupport.ts` and `httpSupport.ts`. Domain logic stays in top-level `backend/src/*.ts` modules. That is a valid intermediate layout, not automatically a design flaw.

Extract a new module when you see duplicated logic, mixed concerns in one file, or domain code that is hard to unit-test because it sits behind HTTP. On the frontend, consider feature folders (for example `features/accounts/`) only when one domain grows across many pages, hooks, and tests—not upfront.

## 10. Verify architecture through tests

- Test pure domain logic close to the code that implements it.
- Use integration or HTTP tests for workflow boundaries, auth checks, and end-to-end request behavior.
- Define the success condition before refactoring, especially when changing data flows or cross-cutting logic.

Use a practical test pyramid:

| Level | Where | Examples in this repo |
|-------|--------|------------------------|
| Unit | `backend/src/*.test.ts` | `transactionBalance.test.ts`, `fx.test.ts` |
| Integration | `backend/test/` | `accountValuation.integration.test.ts` |
| HTTP / workflow | `backend/test/app.http.test.ts` | auth, cross-user access, brokerage cash |
| Golden | `backend/test/golden.integration.test.ts` | ledger scenarios |
| Frontend unit | `frontend/src/**/*.test.ts` | `client.test.ts`, `useAsyncData.test.tsx` |

Prioritize tests for money and balance rules, auth and tenancy, and write flows that update derived state. Skip trivial UI snapshots and formatter-only checks unless they guard real behavior.

CI runs backend tests plus frontend build, test, and lint (see `.github/workflows/ci.yml`). Run the full suite locally from the repo root with `npm test`. When refactoring, add or extend a regression test first, then change the implementation.

## 11. Keep documentation part of the architecture

- Architecture is easier to maintain when the repo explains where logic belongs.
- Keep docs short, linkable, and purpose-specific rather than writing one huge reference.
- Update the relevant doc when the API surface, data model, or routing structure changes.
- Keep this practices guide aligned with the current layout (`backend/src/routes/*`, not a monolithic route file).

In this repository:

- [architecture.md](architecture.md) explains the current request flow and module map.
- [domain.md](domain.md) documents the data model.
- [api.md](api.md) catalogs REST endpoints.
- [frontend.md](frontend.md) maps routes and API clients.
- [README.md](../README.md) covers setup and local development.

## 12. Organize files by responsibility

Place new code where its primary job is obvious:

```text
backend/src/
  routes/                  # HTTP: thin handlers, wired from app.ts
  routes/routeSupport.ts   # serialization, getAccountForUser, date filters
  routes/httpSupport.ts    # HttpError, parsers, handleRouteError
  *.ts                     # domain logic (no Express imports)
  *.test.ts                # unit tests next to domain code
backend/test/              # HTTP, golden, schema integration

frontend/src/
  api/                     # client.ts + one module per backend area
  pages/                   # routable screens
  components/              # shared UI
  state/                   # global or feature React context
  hooks/                   # shared hooks (useAsyncData)
```

Before adding a file, decide whether the change belongs in **domain**, **route**, **API client**, or **UI**. Split by responsibility boundary, not by line count. Avoid god modules: `routeSupport.ts` should not accumulate financial rules; keep those in domain modules.

## 13. Validate and serialize at boundaries

- **HTTP input**: validate at the edge with shared parsers in `httpSupport.ts`; avoid unchecked `Number()` on request bodies.
- **HTTP output**: serialize through `routeSupport.ts` helpers using `toNumber()` and ISO date strings so JSON matches frontend types.
- **Frontend**: declare response shapes in `frontend/src/api/*.ts`; parse `{ error: string }` in `client.ts` for failed requests.
- **Database writes**: wrap multi-step updates that must succeed or fail together in `prisma.$transaction` when partial failure would break invariants (for example instrument valuation plus account recompute).

## Related docs

- [architecture.md](architecture.md) - current system behavior and file map
- [domain.md](domain.md) - data model and entity relationships
- [api.md](api.md) - REST route catalog
- [frontend.md](frontend.md) - frontend route and client map
- [README.md](../README.md) - setup, environment, and local development
