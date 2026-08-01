# Cursor configuration (finance-dashboard)

## Project rules (`.cursor/rules/`)

| File | Mode | When it applies |
|------|------|-----------------|
| [golden-rule.mdc](rules/golden-rule.mdc) | Always Apply | Every Agent session |
| [project-context.mdc](rules/project-context.mdc) | Always Apply | Every Agent session |
| [verification.mdc](rules/verification.mdc) | Always Apply | Every Agent session — tests, frontend lint, coverage before completion |
| [backend.mdc](rules/backend.mdc) | Apply to files | Files under `backend/**` |
| [frontend.mdc](rules/frontend.mdc) | Apply to files | Files under `frontend/**` |
| [docs-maintenance.mdc](rules/docs-maintenance.mdc) | Apply to files | `schema.prisma`, `app.ts`, `backend/src/routes/**`, `frontend/src/api/**`, `App.tsx` |
| [markdown.mdc](rules/markdown.mdc) | Apply to files | `**/*.md`, `**/*.mdx` |
| [line-endings.mdc](rules/line-endings.mdc) | (referenced) | LF enforcement |

`golden-rule.mdc` — behavioral guidelines. `project-context.mdc` — minimal repo map (points to README and `docs/`). Scoped rules add conventions without duplicating full docs.

## Project skills (`.cursor/skills/`)

| Skill | Trigger |
|-------|---------|
| [docs-reader](skills/docs-reader/SKILL.md) | Diátaxis doc routing for daily AI work |
| [docs-author](skills/docs-author/SKILL.md) | Manual — add new Diátaxis pages |
| [docs-audit](skills/docs-audit/SKILL.md) | Manual — docs vs code audit |
| [docs-sync-during-work](skills/docs-sync-during-work/SKILL.md) | Significant API/schema/UI changes — same-chunk docs |
| [fullstack-architecture-review](skills/fullstack-architecture-review/SKILL.md) | Manual — fullstack practices audit and remediation plan |
| [mvp-scope-implementer](skills/mvp-scope-implementer/SKILL.md) | Manual — implement MVP from local scope docs |

## Agent index and docs

- [AGENTS.md](../AGENTS.md) — short router for agents (docs by Diátaxis mode, skills).
- [docs/README.md](../docs/README.md) — Diátaxis hub and AI reading order.
- [docs/meta/code-map.md](../docs/meta/code-map.md) — domain → code paths.
- Attach when needed:
  - `@docs/reference/domain.md` — Prisma models (User baseline)
  - `@docs/reference/api.md` — endpoint list
  - `@docs/explanation/architecture.md` — auth and request flow
  - `@docs/reference/frontend.md` — routes and API clients
  - `@docs/reference/testing.md` — coverage, test pyramid, CI facts
  - `@mvp/CHECKLIST.md` — product backlog (not shipped-code truth)

Human onboarding (install, env, seed): [README.md](../README.md); tutorial: [docs/tutorials/first-run.md](../docs/tutorials/first-run.md).

## Token usage

- **Always Apply** rules stay small; product detail lives in `docs/` (pull via `@` or Read).
- **Glob rules** activate when matching files are in context (backend/frontend edits, doc maintenance).
- Avoid copying README or `docs/reference/api.md` into always-on rules.

## Verification

1. **Cursor Settings → Rules, Commands** — project rules list with status.
2. In Agent chat — context indicator near the prompt: active rules should appear there.
3. Manually: `@golden-rule` or `@docs/reference/api.md` to force-include.
4. After logic changes: [verification.mdc](rules/verification.mdc) and [docs/reference/testing.md](../docs/reference/testing.md) (`npm test`, `npm run test:coverage`).

## Version control

Commit `.cursor/rules/`, `.cursor/skills/`, `AGENTS.md`, and `docs/` so the team shares the same AI instructions and catalogs.
