# Cursor configuration (finance-dashboard)

## Project rules (`.cursor/rules/`)

| File | Mode | When it applies |
|------|------|-----------------|
| [golden-rule.mdc](rules/golden-rule.mdc) | Always Apply | Every Agent session |
| [project-context.mdc](rules/project-context.mdc) | Always Apply | Every Agent session |
| [backend.mdc](rules/backend.mdc) | Apply to files | Files under `backend/**` |
| [frontend.mdc](rules/frontend.mdc) | Apply to files | Files under `frontend/**` |

`golden-rule.mdc` holds general behavioral guidelines (Karpathy). `project-context.mdc` adds this repository’s context. `backend` and `frontend` rules attach automatically when files from those directories are in context.

## Verification

1. **Cursor Settings → Rules, Commands** — project rules list with status.
2. In Agent chat — context indicator near the prompt: active rules should appear there.
3. Manually: `@golden-rule` in chat to force-include a rule again.

## Version control

Commit `.cursor/rules/` to git so the whole team shares the same AI instructions.
