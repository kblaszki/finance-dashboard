---
name: docs-reader
description: >-
  Routes AI reading of finance-dashboard documentation via Diátaxis. Use when
  starting a feature, locating where code or docs live, or before editing an
  unfamiliar area. Picks a minimal file list — never load all docs.
disable-model-invocation: false
---

# Docs reader (Diátaxis)

Read the **smallest** useful set of docs, then open code.

## Start order (required)

1. [AGENTS.md](../../../AGENTS.md) — which docs/skills
2. [docs/README.md](../../../docs/README.md) — Diátaxis compass
3. [docs/meta/code-map.md](../../../docs/meta/code-map.md) — **when locating code**
4. At most **one** page from `docs/tutorials|how-to|reference|explanation/`
5. Then primary code paths from the code map

Never load all of `docs/`. Prefer:

| Need | Mode | Folder |
|------|------|--------|
| Facts (routes, models, thresholds) | reference | `docs/reference/` |
| Concrete task | how-to | `docs/how-to/` |
| Why / background | explanation | `docs/explanation/` |
| First-time learning | tutorial | `docs/tutorials/` |

## Front matter

Each page starts with YAML:

```yaml
diataxis: reference | how-to | explanation | tutorial | meta
use_when: ...
audience: agent | human | both
```

Use `use_when` to decide whether the page matches the user intent before reading the body.

## Redirect stubs

Old paths (`docs/api.md`, `docs/domain.md`, …) are stubs. Follow `redirect` / the link to the new path.

## Output habit

State which files you opened and why (one line). Then proceed to code.
