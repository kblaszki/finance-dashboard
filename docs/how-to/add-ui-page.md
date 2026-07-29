---
diataxis: how-to
use_when: Add a new UI page or route
audience: agent
related_docs:
  - docs/reference/frontend.md
related_code:
  - frontend/src/App.tsx
---

# Add a UI page

Hub: [docs/README.md](../README.md).

1. Route + nav in `frontend/src/App.tsx`.
2. Component under `frontend/src/components/` or `pages/` (or `features/<area>/` for tax/import).
3. Row in [docs/reference/frontend.md](../reference/frontend.md).
4. Prefer `useAsyncData` with a stable `useCallback` loader for page data.
5. Same-chunk docs update per skill `docs-sync-during-work`.
