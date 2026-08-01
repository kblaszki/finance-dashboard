# Adapt advanced-planning to a project

Use this checklist when dropping `advanced-planning` into a new repository (or when
refreshing it after a major restructure). Hand an agent: **"adapt advanced-planning to
this project"** and point it at this file.

Fill every `<!-- PROJECT: ... -->` placeholder. Leave none greppable as empty after
adaptation; search for `<!-- PROJECT:` to find gaps.

## Checklist

```
- [x] 1. Locate behavioral rules
- [x] 2. Map research targets
- [x] 3. Record verify commands
- [x] 4. Capture domain terms
- [x] 5. Set research-agent defaults
- [x] 6. Wire references in SKILL.md
- [ ] 7. Smoke-test with a real task
```

### 1. Locate behavioral rules

Point to the project's always-on behavioral rule (karpathy-style / golden-rule). Do not
copy its text into this skill.

- Behavioral rule path: `.cursor/rules/golden-rule.mdc`
  (also always-on: `.cursor/rules/verification.mdc`, `.cursor/rules/project-context.mdc`)

### 2. Map research targets

List the directories / entry points research subagents should prefer for this repo.

- Key directories: `backend/src/` (routes, auth, lib), `backend/prisma/`, `frontend/src/` (pages, components, api, state), `docs/`, `mvp/`
- Entry points / "start here" files: `AGENTS.md`, `docs/README.md`, `docs/meta/code-map.md`, `backend/src/app.ts`, `frontend/src/App.tsx`
- Areas to treat as independent slices for parallel explore agents:
  `backend routes/domain`, `Prisma schema/migrations`, `frontend API clients`, `frontend pages/components`, `tests`, `docs`

### 3. Record verify commands

Acceptance criteria in Frame/Draft should prefer real, runnable checks from this project.

- Test command: `npm test` (repo root; runs backend tests, frontend tests, then frontend lint)
- Lint / typecheck: `cd frontend && npm run lint` (0 errors, 0 warnings; already included in `npm test`)
- Other verify (build, e2e, docs check): `npm run test:coverage` (backend + frontend thresholds), `npm run build`

### 4. Capture domain terms

List terms the planner must use consistently (link a glossary if one exists).

- Glossary / terms doc: `docs/reference/domain.md` (Prisma models), `docs/reference/requirements.md` (FR map), `docs/meta/code-map.md`
- Must-use terms (short list): `userId` tenancy scoping, `User`, `Account` (BANK type), money/FX in backend domain modules, FR IDs

### 5. Set research-agent defaults

Tune how many explore subagents are typical for this codebase size.

- Default research agents: `2` (typical backend + frontend split)
- Hard max research agents: `4`
- Prefer single-pass research when: change confined to one side (only `backend/` or only `frontend/`) or a known file set

### 6. Wire references in SKILL.md

After filling placeholders above, update [SKILL.md](SKILL.md) only where it needs a
project pointer (e.g. mention the behavioral-rule path in Boundaries, or note the
preferred verify commands under Frame). Keep SKILL.md generic otherwise; put detail here.

### 7. Smoke-test

Run `/advanced-planning` on a real but low-stakes task. Confirm:

- Blocking questions are asked before research.
- Research findings cite real paths.
- Validator returns Blocker / Warning / OK.
- The skill stops without implementing.

## Portable copy

To reuse in another repo: copy the whole `advanced-planning/` directory into that repo's
`.cursor/skills/`, then run this checklist. Do not leave `<!-- PROJECT:` markers unfilled.
