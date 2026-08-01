---
diataxis: reference
use_when: FR/NFR traceability — shipped vs mvp backlog
audience: both
related_docs:
  - mvp/CHECKLIST.md
  - docs/reference/api.md
---

# Requirements map

Hub: [docs/README.md](../README.md).

**Shipped in code** = auth baseline below. Everything else is product backlog in [mvp/CHECKLIST.md](../../mvp/CHECKLIST.md) and `mvp/features/*` — checklist statuses may describe target product intent, not current code.

## Shipped

| ID | Capability | Code / docs |
|----|------------|-------------|
| MVP-001 | Login and register with JWT | [api.md](api.md) auth routes; [account-settings.md](../how-to/account-settings.md) |
| MVP-002 | Profile, email, password settings | `/settings`; auth PATCH routes |
| Ops | Health endpoint | `GET /api/health` |
| Ops | Private deploy tooling | `create-user`, `db:backup`, [private-deploy.md](../how-to/private-deploy.md) |

## Planned / not in this codebase

| Area | Where to look |
|------|----------------|
| Password reset (MVP-003) | [mvp/features/auth/password-reset-api.md](../../mvp/features/auth/password-reset-api.md) |
| Accounts, holdings, tax, import, FX, budgets, … | [mvp/CHECKLIST.md](../../mvp/CHECKLIST.md) |

Do not invent “implemented” rows for domain FRs until the feature ships and docs-sync updates this page.
