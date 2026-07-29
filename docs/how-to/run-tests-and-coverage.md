---
diataxis: how-to
use_when: Run tests and coverage before finishing logic work
audience: both
related_docs:
  - docs/reference/testing.md
---

# Run tests and coverage

Hub: [docs/README.md](../README.md). Facts (thresholds, pyramid, CI): [docs/reference/testing.md](../reference/testing.md).

## Steps

From the repository root:

```bash
npm test
npm run test:coverage
```

1. `npm test` — backend tests, frontend tests, frontend lint (0 errors, 0 warnings).
2. `npm run test:coverage` — when counted logic changed; thresholds must pass.
3. Document new routes in [docs/reference/api.md](../reference/api.md) and new clients in [docs/reference/frontend.md](../reference/frontend.md) when applicable.
4. Report pass/fail in the completion message (see `.cursor/rules/verification.mdc`).

## Skip when

- Documentation-only edits (`.md`, comments with no logic change).
- User explicitly asked for a partial deliverable (plan only, do not run tests).
