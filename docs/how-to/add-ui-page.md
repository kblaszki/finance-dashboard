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

1. Route in `frontend/src/App.tsx` (guest vs `ProtectedRoute` + `AppShell` as appropriate).
2. Component under `frontend/src/pages/` or `frontend/src/components/`.
3. Nav link in `AppShell` when the page is part of the authenticated shell.
4. Row in [docs/reference/frontend.md](../reference/frontend.md).
5. Prefer `useAsyncData` with a stable `useCallback` loader for page data when fetching.
6. Same-chunk docs update per skill `docs-sync-during-work`.
