---
name: mvp-add-feature
description: >-
  Add a new product capability to the finance-dashboard mvp/ feature map:
  create features/<domain>/<slug>.md from the template and register it in
  mvp/CHECKLIST.md. Use when the user asks to add an MVP feature, backlog item,
  or planned capability to the product map.
disable-model-invocation: true
---

# MVP add feature

Add **one** capability to the committed product map under [`mvp/`](../../../mvp/).

## Steps

1. Read [mvp/README.md](../../../mvp/README.md) (domains, statuses) and skim [mvp/CHECKLIST.md](../../../mvp/CHECKLIST.md) for ID collisions.
2. Choose:
   - `id` — existing `FR-xxx` / `NFR-xxx` from [docs/reference/requirements.md](../../../docs/reference/requirements.md), or next free `MVP-xxx` (scan CHECKLIST + `features/**/*.md`).
   - `domain` — one of the folders listed in mvp/README.
   - `status` — default `planned` unless the user says otherwise (`done` | `in_progress` | `stub` | `planned`).
   - `title` and kebab-case `slug` for the filename.
3. Create `mvp/features/<domain>/<slug>.md` using [mvp/_templates/feature.md](../../../mvp/_templates/feature.md). Fill Summary, Surfaces, Acceptance; link docs how-tos when they exist. English; LF only.
4. Update [mvp/CHECKLIST.md](../../../mvp/CHECKLIST.md):
   - Add a row to the **Master table** (ID, Title, Status, Spec link, Primary surface).
   - Add a bullet under the matching **By domain** section.
   - Recalculate **Counts**.
5. Do **not** change application code or `docs/` unless the user asks.
6. Do **not** edit Cursor plan files or link `plans/` from committed docs.

## Commit

If the user wants a commit: one docs commit for the new feature + checklist (e.g. `Add MVP feature FR-xxx to product map.`).
