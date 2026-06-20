# Fullstack Architecture Practices

This guide captures practical habits for building maintainable fullstack applications. It focuses on architectural decisions that keep backend, frontend, and data model changes understandable as the product grows.

The examples in this document use patterns from this repository, but the principles are intentionally general. Use this page for architectural guidance, then follow the linked project docs for the current implementation details.

## 1. Start with clear boundaries

- Keep transport, domain logic, and persistence separate even in a small codebase.
- Let route handlers coordinate work, not own business rules.
- Make it obvious where a new piece of logic belongs before adding code.

In this repository, HTTP entry points live in `backend/src/app.ts`, while reusable domain logic is extracted into modules such as `backend/src/fx.ts`, `backend/src/holdingLot.ts`, `backend/src/transactionBalance.ts`, and `backend/src/netWorth.ts`.

## 2. Keep the request flow boring

- Prefer a predictable request path: validate input, authenticate, load data, apply domain rules, serialize the response.
- Use shared helpers for parsing and serialization so handlers do not drift apart.
- Keep the number of places that can mutate request behavior small.

For the current request flow and layer map, see [architecture.md](architecture.md).

## 3. Design APIs as stable contracts

- Treat each endpoint as a contract between frontend and backend, not just a convenient function call.
- Use consistent JSON shapes, meaningful status codes, and clear resource naming.
- Put public application endpoints under a stable namespace such as `/api/...`.
- Document routes in a concise catalog so contributors know where to extend the surface area.

In this repository, REST handlers live under `/api/...` and are documented in [api.md](api.md). Shared helpers such as `toNumber` and `normalizeCurrency` keep output formatting consistent across handlers.

## 4. Make the data model the source of truth

- Put structural truth in the schema, not in scattered UI assumptions.
- Create a migration for every schema change so data evolution is explicit and reproducible.
- Keep derived values and invariants enforced in backend code close to the models they affect.

Here, the source of truth is `backend/prisma/schema.prisma`, with entity-level documentation in [domain.md](domain.md). Ledger-style invariants such as running balances and holding quantities are maintained in backend modules rather than inferred in the frontend.

## 5. Put domain rules in one place

- Shared rules should have a single implementation, especially for money, dates, pricing, and balances.
- Avoid copying the same business rule into route handlers, charts, and UI tables.
- If a rule is important enough to mention in docs, it is important enough to centralize in code.

This repository already follows that pattern for FX conversion in `backend/src/fx.ts`, holding lot behavior in `backend/src/holdingLot.ts`, and transaction balance calculations in `backend/src/transactionBalance.ts`.

## 6. Build auth and tenancy into the architecture

- Authenticate once at the edge, then pass trusted identity through the request lifecycle.
- Authorize every data access with explicit tenant or user scoping.
- Keep secrets in environment variables only, and never couple local development convenience with production security.
- Fail closed when auth state is missing or invalid.

In this repository, `backend/src/auth.ts` provides JWT handling and `requireAuth`, while backend queries are scoped by `userId`. The frontend centralizes token handling in `frontend/src/api/client.ts`.

## 7. Keep frontend data access centralized

- UI components should render state, not know how authentication headers or base URLs work.
- Use a shared client for cross-cutting concerns such as auth headers, error handling, and request defaults.
- Group API calls by domain area so the frontend mirrors the backend's public surface.

In this repository, low-level request behavior lives in `frontend/src/api/client.ts`, while feature-oriented modules under `frontend/src/api/` expose domain-specific calls.

## 8. Scope frontend state intentionally

- Keep global state small and reserved for truly shared concerns.
- Prefer page-level or feature-level state when only one workflow needs it.
- Do not introduce parallel state patterns unless the current one is clearly failing.

Examples here include shared contexts for auth, currency, and theme under `frontend/src/state/`, with routing defined in `frontend/src/App.tsx`. For the current route map, see [frontend.md](frontend.md).

## 9. Let structure evolve with real pressure

- Start with the simplest structure that keeps responsibilities clear.
- Extract modules when repeated patterns or growing complexity create real maintenance cost.
- Split by domain boundary before adding abstractions for their own sake.

That tradeoff matters in this repository: `backend/src/app.ts` remains a single route file, while domain-specific logic has already moved into supporting modules. That is a valid intermediate architecture, not automatically a design flaw.

## 10. Verify architecture through tests

- Test pure domain logic close to the code that implements it.
- Use integration or HTTP tests for workflow boundaries, auth checks, and end-to-end request behavior.
- Define the success condition before refactoring, especially when changing data flows or cross-cutting logic.

This repository keeps tests at both levels: unit-oriented coverage in `backend/src/*.test.ts` and broader HTTP or golden-path coverage in `backend/test/`. Run the suite from the repo root with `npm test`.

## 11. Keep documentation part of the architecture

- Architecture is easier to maintain when the repo explains where logic belongs.
- Keep docs short, linkable, and purpose-specific rather than writing one huge reference.
- Update the relevant doc when the API surface, data model, or routing structure changes.

In this repository:

- [architecture.md](architecture.md) explains the current request flow and module map.
- [domain.md](domain.md) documents the data model.
- [api.md](api.md) catalogs REST endpoints.
- [frontend.md](frontend.md) maps routes and API clients.
- [README.md](../README.md) covers setup and local development.

## Related docs

- [architecture.md](architecture.md) - current system behavior and file map
- [domain.md](domain.md) - data model and entity relationships
- [api.md](api.md) - REST route catalog
- [frontend.md](frontend.md) - frontend route and client map
- [README.md](../README.md) - setup, environment, and local development
