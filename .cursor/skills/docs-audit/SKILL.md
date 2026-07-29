---
name: docs-audit
description: >-
  Audit finance-dashboard documentation against code. Use for periodic doc
  freshness checks, after large PRs, or when asked if docs are stale. Trust code
  when docs disagree; output findings only unless asked to fix.
disable-model-invocation: true
---

# Docs audit (docs vs code)

Produce a **findings report**, not code changes, unless the user asks to fix drift.

## Workflow

```text
Audit progress:
- [ ] Step 1: Read docs/README.md + AGENTS.md + meta/code-map.md
- [ ] Step 2: Compare routes ↔ docs/reference/api.md
- [ ] Step 3: Compare schema ↔ docs/reference/domain.md
- [ ] Step 4: Compare App.tsx + api/* ↔ docs/reference/frontend.md
- [ ] Step 5: Compare CI/coverage ↔ docs/reference/testing.md
- [ ] Step 6: Spot-check architecture module map ↔ backend/src
- [ ] Step 7: Spot-check code-map rows vs real paths
- [ ] Step 8: Write findings + Now/Next remediation
```

## Minimum checks

| Source of truth | Doc |
|-----------------|-----|
| `backend/src/routes/*` + `mountRouters.ts` / `app.ts` | `docs/reference/api.md` |
| `backend/prisma/schema.prisma` | `docs/reference/domain.md` |
| `frontend/src/App.tsx` + `frontend/src/api/*` | `docs/reference/frontend.md` |
| `.github/workflows/ci.yml`, coverage configs | `docs/reference/testing.md` |
| `backend/src` layout | `docs/explanation/architecture.md` |
| Primary paths | `docs/meta/code-map.md` |

**If docs disagree with code, trust the code** and mark the doc stale.

## Output format

```markdown
# Docs audit — YYYY-MM-DD

## Summary
[2–4 sentences]

## Findings
| Severity | Area | Problem | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| High/Med/Low | api/domain/… | Missing/Stale/Extra | paths | … |

## Remediation
### Now
1. …
### Next
1. …
```

Do not implement fixes unless asked.
