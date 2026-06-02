# Cursor configuration (finance-dashboard)

## Project rules (`.cursor/rules/`)

| File | Mode | When it applies |
|------|------|-----------------|
| [golden-rule.mdc](rules/golden-rule.mdc) | Always Apply | Every Agent session |
| [project-context.mdc](rules/project-context.mdc) | Always Apply | Every Agent session |
| [backend.mdc](rules/backend.mdc) | Apply to files | Files under `backend/**` |
| [frontend.mdc](rules/frontend.mdc) | Apply to files | Files under `frontend/**` |
| [docs-maintenance.mdc](rules/docs-maintenance.mdc) | Apply to files | `schema.prisma`, `app.ts`, `frontend/src/api/**`, `App.tsx` |
| [markdown.mdc](rules/markdown.mdc) | Apply to files | `**/*.md`, `**/*.mdx` |
| [line-endings.mdc](rules/line-endings.mdc) | (referenced) | LF enforcement |

`golden-rule.mdc` — behavioral guidelines. `project-context.mdc` — minimal repo map (points to README and `docs/`). Scoped rules add conventions without duplicating full docs.

## Agent index and docs

- [AGENTS.md](../AGENTS.md) — short router for agents (recipes, links).
- [docs/](../docs/) — deep reference; **not** loaded every session. Attach when needed:
  - `@docs/domain.md` — portfolios, trades, budgets
  - `@docs/api.md` — endpoint list
  - `@docs/architecture.md` — auth, FX, file layout
  - `@docs/frontend.md` — routes and API clients

Human onboarding (install, env, seed): [README.md](../README.md).

## Token usage

- **Always Apply** rules stay small; product detail lives in `docs/` (pull via `@` or Read).
- **Glob rules** activate when matching files are in context (backend/frontend edits, doc maintenance).
- Avoid copying README or `docs/api.md` into always-on rules.

## Verification

1. **Cursor Settings → Rules, Commands** — project rules list with status.
2. In Agent chat — context indicator near the prompt: active rules should appear there.
3. Manually: `@golden-rule` or `@docs/api.md` to force-include.

## Version control

Commit `.cursor/rules/`, `AGENTS.md`, and `docs/` so the team shares the same AI instructions and catalogs.
