---
name: fullstack-architecture-review
description: >-
  Performs a periodic fullstack architecture and engineering-practices review of
  finance-dashboard. Evaluates the repo against docs/fullstack-architecture-practices.md,
  analyzes backend/frontend/docs/CI, and produces a prioritized remediation plan for
  delegation. Use when the user asks for a fullstack review, architecture audit,
  engineering practices audit, or a remediation roadmap for this project.
disable-model-invocation: true
---

# Fullstack Architecture Review

Produce a **delegatable remediation plan**, not code changes, unless the user explicitly asks to implement fixes.

## When to use

Run manually when the user wants a periodic health check of the whole project:
- architecture review
- fullstack best-practices audit
- remediation / improvement roadmap
- "what should we fix now vs later?"

Do **not** auto-invoke for normal feature work.

## Primary rubric

Use [docs/fullstack-architecture-practices.md](../../../docs/fullstack-architecture-practices.md) as the main standard. Map every finding to one or more of its **13 sections**.

Treat these as supporting evidence, not substitutes for reading code:
- [docs/architecture.md](../../../docs/architecture.md)
- [docs/domain.md](../../../docs/domain.md)
- [docs/api.md](../../../docs/api.md)
- [docs/frontend.md](../../../docs/frontend.md)
- [AGENTS.md](../../../AGENTS.md)

If docs disagree with code, **trust the code** and note doc drift as a finding.

## Review workflow

Copy this checklist and track progress:

```text
Review progress:
- [ ] Step 1: Read rubric + current architecture docs
- [ ] Step 2: Inspect backend transport, domain modules, auth, data flows
- [ ] Step 3: Inspect frontend routes, API clients, state, UI/data coupling
- [ ] Step 4: Inspect tests, CI, repo tooling, docs maintenance
- [ ] Step 5: Synthesize findings by severity and practice area
- [ ] Step 6: Write remediation plan (Now / Next / Later)
```

### Step 1: Establish context

Read, at minimum:
- `docs/fullstack-architecture-practices.md`
- `docs/testing.md`
- `docs/architecture.md`
- `backend/src/app.ts`
- `backend/src/routes/`
- `frontend/src/App.tsx`
- `frontend/src/api/`
- `.github/workflows/ci.yml`
- root `package.json`, `backend/package.json`, `frontend/package.json`

For deeper checklist items, read [checklist.md](checklist.md).

### Step 2: Backend review

Focus on:
- route boundaries vs domain logic (`backend/src/routes/*`, `backend/src/*.ts`)
- `routeSupport.ts` vs domain modules (serialization/tenancy only; financial rules in `accountValuation.ts` and peers)
- auth and tenancy (`backend/src/auth.ts`, `userId` scoping; shared instruments catalog)
- financial correctness and atomicity (transactions, ledger invariants, valuation recompute, brokerage cash replay)
- API contract consistency (serializers, validation, status codes via `httpSupport.ts`)
- cross-cutting rules centralized once (`backend/src/fx.ts`, balance/lot helpers)
- scalability risks (N+1 queries, synchronous heavy recompute, global/shared mutable data)

Run targeted tests when useful:
- `npm test` from repo root
- `npm run test:coverage` when reviewing test/CI posture (see `docs/testing.md`)

### Step 3: Frontend review

Focus on:
- centralized API client (`frontend/src/api/client.ts`)
- handwritten contracts vs backend responses (`frontend/src/api/*.ts`)
- route/state boundaries (`frontend/src/App.tsx`, `frontend/src/state/`)
- `useAsyncData` vs ad-hoc `useEffect` fetching; loading/error/empty UX
- display semantics vs backend contract (especially currency/stats formatting)
- frontend verification (`client.test.ts`, `apiModules.test.ts`, hook tests; gaps in component/E2E coverage)

Run when useful:
- `cd frontend && npm run build`
- `cd frontend && npm run lint` (report failures; do not fix unless asked)
- `npm run test:coverage` from repo root when assessing coverage gaps (see `docs/testing.md`)

### Step 4: Repo / docs / CI review

Focus on:
- whether CI matches [docs/testing.md](../../../docs/testing.md) (backend tests, frontend build/test/lint, coverage thresholds)
- whether docs index matches reality (`AGENTS.md`, `docs/*`, practices doc vs `routes/*`)
- whether change discipline is clear (where to add routes, clients, docs)
- monorepo ergonomics (install/build/test from root vs split packages)

### Step 5: Classify findings

Use these severities:

| Severity | Meaning |
|----------|---------|
| Critical | Correctness, security, tenancy, or data-integrity risk |
| High | Likely to cause regressions, contract drift, or serious maintenance pain soon |
| Medium | Real architectural debt or missing guardrails, but not immediately breaking |
| Low | Polish, consistency, or future-proofing |

Also tag each finding with:
- **Practice area** (section 1–13 from `fullstack-architecture-practices.md`)
- **Layer** (`backend`, `frontend`, `data`, `docs`, `ci`, `cross-cutting`)
- **Evidence** (file paths, tests, observed behavior)

Avoid generic advice. Every finding must point to concrete repo evidence.

### Step 6: Write the remediation plan

Deliver **one complete plan** the user can assign for implementation.

Use the user's language for prose. Keep file paths, commands, and identifiers in English.

## Required output format

Use this structure exactly:

```markdown
# Fullstack Architecture Review — [YYYY-MM-DD]

## Executive summary
[3-6 sentences: overall health, biggest risks, recommended focus for the next iteration]

## Architecture snapshot
[Short description of current backend/frontend/data/test layout based on code, not assumptions]

## Practices compliance
| Practice (from fullstack-architecture-practices.md) | Status | Notes |
|---|---|---|
| 1. Clear boundaries | Pass / Partial / Fail | ... |
| 2. Boring request flow | Pass / Partial / Fail | ... |
| 3. Stable API contracts | Pass / Partial / Fail | ... |
| 4. Data model as source of truth | Pass / Partial / Fail | ... |
| 5. Domain rules in one place | Pass / Partial / Fail | ... |
| 6. Auth and tenancy | Pass / Partial / Fail | ... |
| 7. Centralized frontend data access | Pass / Partial / Fail | ... |
| 8. Scoped frontend state | Pass / Partial / Fail | ... |
| 9. Pragmatic structure evolution | Pass / Partial / Fail | ... |
| 10. Tests and verification | Pass / Partial / Fail | ... |
| 11. Documentation discipline | Pass / Partial / Fail | ... |
| 12. Organize files by responsibility | Pass / Partial / Fail | ... |
| 13. Validate and serialize at boundaries | Pass / Partial / Fail | ... |

## Findings

### Critical
- **[Title]** — practice: [N. ...], layer: [backend/...]
  - Problem:
  - Evidence:
  - Impact:
  - Recommended fix:

### High
...

### Medium
...

### Low
...

## Growth opportunities
[Where the architecture can evolve well if the product grows — modules, contracts, jobs, persistence, UX/data-fetching, etc.]

## Remediation roadmap

### Now (do first)
1. **[Work package title]**
   - Goal:
   - Scope:
   - Primary files:
   - Success criteria:
   - Suggested verification:

### Next
...

### Later
...

## Suggested execution order
[Numbered list of work packages in dependency-aware order]

## Out of scope for this review
[Only if relevant — things intentionally not recommended now]
```

## Work package rules

Each item in **Now / Next / Later** must be delegatable as a standalone task:
- one clear goal
- bounded scope (avoid "refactor everything")
- explicit success criteria
- verification steps (`npm test`, `npm run test:coverage` when logic changed — [docs/testing.md](../../../docs/testing.md), specific HTTP/integration checks, build/lint, manual UI checks)

Prefer small, reviewable packages over large rewrites.

## Review quality bar

Before finishing, verify:
- Every **Critical** and **High** finding has a matching work package in **Now** or **Next**
- Findings are backed by repo evidence, not generic best-practice slogans
- Every finding maps to practice section **1–13**
- The plan distinguishes **correctness bugs**, **architecture debt**, and **future scalability**
- Doc drift is called out when `docs/*` no longer matches code
- You did not propose large abstractions unless real pain exists in the codebase

## Constraints

- Default mode: **analysis and planning only**
- Do not edit code, docs, CI, or tests unless the user explicitly asks to implement fixes
- Do not create commits or PRs unless explicitly requested
- Do not duplicate long content from `docs/*`; link to the relevant doc instead
- Keep the final plan actionable enough that another agent or developer can execute it without re-auditing the whole repo

## Optional deep dives

If the repo changed significantly since the last review, prioritize:
1. financial write flows and derived state (including brokerage cash replay)
2. auth/tenancy boundaries and shared global resources
3. backend/frontend contract drift and serializers
4. test/CI gaps (HTTP tenancy, frontend client/hooks, coverage thresholds, lint)
5. route/module boundary growth in `backend/src/routes/`
6. `handleRouteError` and validation consistency at HTTP boundaries
7. market data sync (`marketData*.ts`, external provider, valuation recompute side effects)

For detailed inspection prompts, see [checklist.md](checklist.md).
