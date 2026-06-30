---
name: mvp-scope-implementer
description: >-
  Implements finance-dashboard MVP from a local docs directory (database/, mvp/scope.md,
  requirements/). Compares scope to the repo, ships missing work in small commits with
  full test/coverage verification, and re-runs until scope.md is satisfied. Use when
  the user invokes scope-driven MVP implementation or points at a docs root under plans/.
disable-model-invocation: true
---

# MVP Scope Implementer

Implement the repository until it matches **`mvp/scope.md`** in a user-supplied documentation directory. Work in small steps with git commits, full verification, and periodic architecture review.

**Default mode:** implement and commit (unless the user says "plan only" or "no commits").

## When to use

Invoke manually when the user:

- Points at a docs root (e.g. `plans/my-mvp`) and asks to implement the MVP
- Says "implement scope", "wdrażaj scope", or references `scope.md`
- Wants iterative delivery until scope acceptance criteria are met

Do **not** auto-invoke for unrelated tasks.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `<docs-root>` | Yes | Path to documentation tree (absolute or repo-relative) |
| Commit policy | No | Default: commit each step; user may say "no commits" |

Supporting references (read on demand):

- [layout.md](layout.md) — required directory structure and templates
- [traceability.md](traceability.md) — gap matrix and progress tracking
- [commit-format.md](commit-format.md) — commit message rules

## Repo context (link, do not duplicate)

- [AGENTS.md](../../../AGENTS.md) — recipes (schema, API, UI, tests)
- [.cursor/rules/verification.mdc](../../../.cursor/rules/verification.mdc) — mandatory checks
- [docs/testing.md](../../../docs/testing.md) — pyramid, coverage thresholds, where to add tests
- [.cursor/rules/golden-rule.mdc](../../../.cursor/rules/golden-rule.mdc) — minimal diffs

Committed docs (`docs/*`) are English. Local `plans/` docs may be any language. **Never link `plans/` from committed docs.**

---

## Phase 0: Validate docs root

Verify structure per [layout.md](layout.md):

```text
<docs-root>/
  database/
  mvp/scope.md
  requirements/
```

If validation fails, list missing paths and **stop**. Do not guess scope.

---

## Phase 1: Load and synthesize

Copy checklist:

```text
Load progress:
- [ ] Read mvp/scope.md (entire file)
- [ ] Read all requirements/*.md
- [ ] Read database/*
- [ ] Build traceability matrix (traceability.md template)
- [ ] Gap analysis vs current repo
- [ ] Ordered work queue
```

### Reading rules

1. **`scope.md` wins** over individual requirement files on conflict — note conflicts and ask the user one question at a time.
2. **Trust code over stale docs** when comparing to existing `docs/*`; update committed docs after implementation.
3. Extract explicit **out of scope** items; mark matrix rows `out_of_scope`.

### Gap analysis

For each scope/requirement row, record current repo evidence:

| Layer | Compare against |
|-------|-----------------|
| Schema | `backend/prisma/schema.prisma` vs `database/` |
| API | `backend/src/routes/`, `docs/api.md` |
| Domain | `backend/src/*.ts` (fx, valuations, balances) |
| Client | `frontend/src/api/` |
| UI | `frontend/src/App.tsx`, `docs/frontend.md` |
| Tests | `backend/test/`, `frontend/src/api/*.test.ts` |

Present a short gap summary before coding unless the user said "just implement".

---

## Phase 2: Queue work packages

Order packages by dependency (AGENTS.md recipes):

1. Prisma schema + migration
2. Domain modules + routes + HTTP/integration tests
3. Frontend API client + `apiModules.test.ts` + `apiContracts` fixtures if JSON shape is new
4. UI pages/components + routing
5. Update `docs/domain.md`, `docs/api.md`, `docs/frontend.md` for shipped behavior

**One logical commit per package** when possible. Split large packages (e.g. schema vs API vs UI).

---

## Phase 3: Implementation loop

Repeat until every matrix row is `done` or `out_of_scope`:

```text
Step progress:
- [ ] Pick next pending row (respect dependencies)
- [ ] Implement minimal diff
- [ ] Add/update tests
- [ ] Run verification
- [ ] Fix failures
- [ ] Commit (if commits enabled)
- [ ] Update matrix status
- [ ] Architecture review (if trigger fired)
```

### Per-step implementation

- Follow existing patterns in touched files.
- New route: `backend/src/routes/<area>Routes.ts` → wire in `app.ts` → client in `frontend/src/api/` → row in `docs/api.md`.
- New model: `schema.prisma` → `npx prisma migrate dev` → `docs/domain.md`.
- New page: `App.tsx` → component → `docs/frontend.md`.
- Financial rules: centralize in domain modules (`fx.ts`, `accountValuation.ts`, etc.) — not in route handlers.

### Tests (required for logic changes)

| Change | Add |
|--------|-----|
| Domain module | `backend/src/<name>.test.ts` |
| Route/workflow | `backend/test/app.http.test.ts` and/or integration tests |
| New API client module | `frontend/src/api/apiModules.test.ts` |
| New JSON response shape | `apiContracts.test.ts` + fixtures |

Prioritize money, balances, auth/tenancy, and write flows. See [docs/testing.md](../../../docs/testing.md).

### Verification (run from repo root)

| When | Command | Pass |
|------|---------|------|
| Every step | `npm test` | exit 0 (includes frontend lint) |
| Logic in `backend/src/`, routes, `frontend/src/api/` | `npm run test:coverage` | thresholds in docs/testing.md |
| UI-only step (no counted paths) | `npm run test:coverage` | at least every 2–3 steps |

**Never** claim green without command output. Fix failures before the next step or commit.

Report after verification:

```text
npm test: pass|fail
npm run test:coverage: pass|fail|skipped (reason)
```

### Commits

When commits are enabled, follow [commit-format.md](commit-format.md):

- Professional title describing the change
- No mentions of Cursor, AI, Claude, agents, or similar
- Stage only step-related files
- User git safety protocol (status, diff, log, HEREDOC message)

Commit fix-ups for test/lint/coverage failures in separate commits or before the first commit of a failed step.

### Architecture review cadence

Read [.cursor/skills/fullstack-architecture-review/SKILL.md](../fullstack-architecture-review/SKILL.md) and apply its rubric:

| Trigger | Action |
|---------|--------|
| After schema change or >3 new endpoints | Mini-review (steps 1–5 of review skill) |
| Every 3–5 commits | Review recent changes for Critical/High issues |
| Before declaring scope complete | Mandatory final review |

Unlike the review skill's default, **this skill implements** findings that:

- Are Critical or High **and**
- Block correctness, tenancy, tests, or coverage **or** are explicitly in scope

Address each in a dedicated commit. Medium/Low: fix if trivial; else note in final report.

---

## Phase 4: Completion

Done only when **all** are true:

- Every matrix row: `done` or `out_of_scope` (with scope citation)
- Latest `npm test` and `npm run test:coverage`: pass
- `docs/api.md`, `docs/domain.md`, `docs/frontend.md` match shipped code
- Final architecture review completed; Critical/High in-scope items resolved

### Final report template

```markdown
# MVP scope implementation — complete

Docs root: <path>

## Summary
[2–4 sentences]

## Traceability
| ID | Status | Commit(s) |
|----|--------|-----------|

## Commits (session)
- title 1
- title 2

## Verification
- npm test: pass
- npm run test:coverage: pass

## Out of scope / deferred
- …

## Architecture notes
[Optional: Medium/Low items left for later]
```

---

## Constraints

- Do not edit Cursor plan files (`.cursor/plans/*`).
- Do not commit `plans/` or secrets (`.env`, `*.db`).
- Do not expand scope beyond `scope.md` + `requirements/` without asking.
- Do not link `plans/` from committed documentation.
- Do not stop early while pending rows remain unless blocked — ask the user.

## Invocation example

```text
/mvp-scope-implementer

docs-root: plans/my-mvp
Implement scope.md; commit each step.
```

## Additional resources

- [layout.md](layout.md) — directory layout and templates
- [traceability.md](traceability.md) — matrix and session progress
- [commit-format.md](commit-format.md) — git commit rules
