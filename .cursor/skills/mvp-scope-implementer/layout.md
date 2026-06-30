# Documentation layout (mvp-scope-implementer)

The user provides a **docs root** directory. This skill expects exactly three subdirectories plus one mandatory file.

## Required structure

```text
<docs-root>/
  database/
    ...                  # DB target skeleton (e.g. schema.dbml, notes)
  mvp/
    scope.md             # REQUIRED — MVP contract (source of truth for scope)
  requirements/
    *.md                 # One or more detailed requirement files
```

### Validation

Stop and report errors if any of these are missing:

- Directory `database/`
- Directory `mvp/`
- File `mvp/scope.md`
- Directory `requirements/` (may be empty only if all detail lives in `scope.md`)

Do not invent missing files. Ask the user to add them or reorganize an existing `plans/` tree.

## Reading order

1. **`mvp/scope.md`** — full file, all sections.
2. **`requirements/*.md`** — all files, alphabetical by filename.
3. **`database/*`** — schema and notes last (implementation target for Prisma delta).

## Typical `database/` contents

| File | Purpose |
|------|---------|
| `schema.dbml` | Target ER in DBML (dbdiagram extension) |
| `README.md` | Notes on tenancy, enums, deferred tables |
| `delta.md` | Optional explicit list: add / change / remove vs current Prisma |

Map `database/` to [`backend/prisma/schema.prisma`](../../../backend/prisma/schema.prisma) during gap analysis.

## `scope.md` template (minimal)

Users may start from this shape (Polish or English in local docs; committed `docs/*` stay English per project rules):

```markdown
# MVP scope

Date: YYYY-MM-DD
Docs root: (path)

## Goal

One paragraph: what the MVP must do for the user.

## In scope

- [ ] Feature or capability 1
- [ ] Feature or capability 2

## Out of scope

- Deferred item (explicit)

## Pages / routes

| Route | Purpose | Priority |
|-------|---------|------------|
| `/` | … | H |

## Data model (summary)

Bullet list of new/changed models or fields. Detail in `database/`.

## API (summary)

Bullet list of new/changed endpoints.

## Acceptance

How to know MVP is done (manual checks + tests).

## Dependencies

Order constraints between work packages.
```

## `requirements/` file template (minimal)

One file per feature area or requirement cluster:

```markdown
# REQ: Short title

Source ID: R-001
Priority: H | M | L
Related scope: scope.md §…

## Behavior

What the system must do.

## Data

Models, fields, relationships.

## API

Methods, paths, request/response shapes.

## UI

Widgets, pages, empty/error states.

## Tests

Expected test types (HTTP, unit, apiModules, apiContracts).

## Open questions

- (none)
```

## Relationship to `plans/`

Local planning under `plans/` is gitignored. This skill reads from the user-supplied `<docs-root>` only. Never add links from committed `docs/*` or `README.md` to `plans/`.
