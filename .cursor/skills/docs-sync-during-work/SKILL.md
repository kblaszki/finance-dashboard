---
name: docs-sync-during-work
description: >-
  Require same-chunk documentation updates when changing finance-dashboard API,
  schema, UI routes/clients, auth/FX/architecture, or test gates. Use during
  feature implementation and before commits. Highest-priority docs skill.
disable-model-invocation: false
---

# Docs sync during work

**Hard gate:** significant code changes ship with matching Diátaxis doc updates in the **same logical commit chunk**.

## When this applies

Significant = any of:

- New or changed REST route
- New or changed Prisma model/field
- New or changed UI page/route or `frontend/src/api/*Api.ts` module
- Auth, FX, or architecture/module-map behavior change
- Test pyramid / coverage threshold / CI gate change

**N/A (skip docs):** typos, CSS-only, comments-only, pure refactors with no public surface change.

## Behavior

1. **Before coding** — skim via `docs-reader` (AGENTS → hub → code-map → one page).
2. **During coding** — update the destination page(s) below in the same chunk as the code.
3. **Before commit** — confirm docs updated or explicitly state N/A and why.

## Destination map

| Change | Update |
|--------|--------|
| REST route | [docs/reference/api.md](../../../docs/reference/api.md) (+ how-to if new workflow) |
| Prisma model/field | [docs/reference/domain.md](../../../docs/reference/domain.md) |
| Page / API client | [docs/reference/frontend.md](../../../docs/reference/frontend.md) |
| Auth / FX / module map | [docs/explanation/architecture.md](../../../docs/explanation/architecture.md) |
| Test layout / thresholds | [docs/reference/testing.md](../../../docs/reference/testing.md) |
| Primary code path moves | [docs/meta/code-map.md](../../../docs/meta/code-map.md) |

New page needed → use skill `docs-author` (front matter + AGENTS/hub indexes).

## Also follow

- [`.cursor/rules/docs-maintenance.mdc`](../../rules/docs-maintenance.mdc)
- [`.cursor/rules/verification.mdc`](../../rules/verification.mdc) before commit when logic changed
- [`.cursor/rules/golden-rule.mdc`](../../rules/golden-rule.mdc) §5 commit logical chunks (no push unless asked)

## Completion checklist

```text
- [ ] Significant change? If yes, docs path updated
- [ ] Front matter still valid on touched doc pages
- [ ] code-map row updated if primary path changed
- [ ] Stated in completion message: docs updated | N/A (reason)
```
