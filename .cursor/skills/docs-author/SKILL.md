---
name: docs-author
description: >-
  Add or extend finance-dashboard documentation under the Diátaxis tree. Use when
  the user asks to document something new, or when docs-sync-during-work needs a
  new page. Requires YAML front matter and index updates.
disable-model-invocation: true
---

# Docs author (Diátaxis)

Create or update **one-mode** pages under `docs/`.

## Choose the folder

| Mode | Folder | Write like |
|------|--------|------------|
| tutorial | `docs/tutorials/` | Guided first success; numbered steps |
| how-to | `docs/how-to/` | Goal-oriented recipe; imperative steps |
| reference | `docs/reference/` | Tables of facts; no narrative teaching |
| explanation | `docs/explanation/` | Why / context; no step checklists |
| meta | `docs/meta/` | Agent maps only (e.g. code-map) |

Do **not** mix modes in one file. Prefer updating an existing page over creating a near-duplicate.

## Required front matter

```yaml
---
diataxis: how-to
use_when: short trigger phrase for agents
audience: both
---
```

Optional: `related_docs`, `related_code` (short path lists only).

Refuse to add a page without valid `diataxis`, `use_when`, and `audience`.

## Scaffold

```markdown
---
diataxis: how-to
use_when: …
audience: agent
---

# Title

Hub: [docs/README.md](../README.md).

1. …
2. …
```

## After writing

1. Add a row to [docs/README.md](../../../docs/README.md) if a new page was created (or ensure the hub still lists the folder).
2. Add a row to [AGENTS.md](../../../AGENTS.md) Docs table for that quadrant.
3. If documenting a new primary code entry, update [docs/meta/code-map.md](../../../docs/meta/code-map.md).
4. English prose; tables over long prose; no large JSON dumps.
5. Commit as a docs chunk per golden-rule when done as a distinct unit.
