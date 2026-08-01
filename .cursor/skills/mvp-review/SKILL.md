---
name: mvp-review
description: >-
  Review the finance-dashboard mvp/ feature map: verify CHECKLIST.md matches
  feature files, front matter is valid, and statuses still make sense versus
  code. Use when the user asks to review MVP checklist, audit product map, or
  check feature backlog drift.
disable-model-invocation: true
---

# MVP review

Audit the product feature map under [`mvp/`](../../../mvp/). **Report only** unless the user explicitly asks to fix the checklist.

## Checklist

```text
MVP review:
- [ ] List mvp/features/**/*.md
- [ ] Parse mvp/CHECKLIST.md master table
- [ ] Every feature file ↔ checklist row (no orphans either way)
- [ ] Front matter: id, status, domain, title; status ∈ done|in_progress|stub|planned
- [ ] Domain folder matches front matter domain
- [ ] Counts in CHECKLIST match row tallies
- [ ] Spot-check sample done vs code; check all stub|planned vs code
- [ ] Write findings report
```

## How to verify status vs code

Trust code over the map:

| Status | Expect |
|--------|--------|
| `done` | Matching route and/or API handler exists and is usable |
| `stub` | UI/API present but incomplete (e.g. PSD2 authorize stub) |
| `planned` | No meaningful implementation |
| `in_progress` | Partial code exists |

Use [docs/reference/requirements.md](../../../docs/reference/requirements.md), [docs/meta/code-map.md](../../../docs/meta/code-map.md), `frontend/src/App.tsx`, and `backend/src/routes/*` for spot checks.

## Output format

```markdown
# MVP review — YYYY-MM-DD

## Summary
[2–4 sentences]

## Counts
| done | stub | planned | in_progress | files | checklist rows |
|------|------|---------|-------------|-------|----------------|

## Findings
| Severity | Problem | Evidence | Suggested fix |
|----------|---------|----------|---------------|

## Verdict
OK | Needs update
```

## Rules

- Do not invent new backlog items during review.
- Do not link or commit `plans/`.
- If asked to **fix**, update feature front matter and CHECKLIST only (minimal diff).
