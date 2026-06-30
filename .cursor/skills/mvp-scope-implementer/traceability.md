# Traceability matrix (mvp-scope-implementer)

Copy this table at the start of an implementation run and update after each step.

## Master matrix

| ID | Source | Requirement summary | Layer | Repo evidence (before) | Work package | Tests added | Status |
|----|--------|---------------------|-------|------------------------|--------------|-------------|--------|
| S-01 | scope.md §… | | schema / api / ui / domain | | | | pending |
| R-01 | requirements/foo.md | | | | | | pending |

**Status values:** `pending` | `in_progress` | `done` | `blocked` | `out_of_scope`

## ID conventions

| Prefix | Source |
|--------|--------|
| `S-` | `mvp/scope.md` section or bullet |
| `R-` | `requirements/<file>.md` |
| `D-` | `database/` artifact (model, field, relation) |

## Layer values

Use one primary layer per row:

- `schema` — Prisma models, migrations
- `domain` — `backend/src/*.ts` business logic
- `api` — routes, serializers, HTTP tests
- `client` — `frontend/src/api/*`
- `ui` — pages, components, routing
- `docs` — `docs/api.md`, `docs/domain.md`, `docs/frontend.md`

## Gap analysis checklist

After reading docs, fill "Repo evidence (before)" from code — not assumptions:

| Check | Where to look |
|-------|----------------|
| Schema delta | `backend/prisma/schema.prisma` vs `database/*` |
| REST surface | `backend/src/routes/`, `docs/api.md` |
| UI routes | `frontend/src/App.tsx`, `docs/frontend.md` |
| API clients | `frontend/src/api/` |
| Tests | `backend/test/app.http.test.ts`, `frontend/src/api/apiModules.test.ts` |

## Work package rules

- One row may map to one commit when scope is small.
- Large rows split into `S-01a`, `S-01b` with explicit dependencies.
- `out_of_scope` only when `scope.md` or a requirement file explicitly defers it.

## Session progress block

Paste in chat each iteration:

```text
MVP scope progress:
- Done: S-01, R-02
- In progress: S-03
- Pending: R-04, D-01
- Blocked: (none)
- Last verify: npm test pass, npm run test:coverage pass
- Commits this session: [titles]
```
