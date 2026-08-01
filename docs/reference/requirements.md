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

**Shipped in code** = auth + multi-type accounts + cash ledger below. Remaining backlog: [mvp/CHECKLIST.md](../../mvp/CHECKLIST.md) and `mvp/features/*`. Checklist: 7 done / 0 in_progress / 55 planned (as of 2026-08-01).

## Shipped

| ID | Capability | Code / docs |
|----|------------|-------------|
| MVP-001 | Login and register with JWT | [api.md](api.md) auth routes; [account-settings.md](../how-to/account-settings.md) |
| MVP-002 | Profile, email, password settings | `/settings`; auth PATCH routes |
| MVP-050 | Health endpoint | `GET /api/health` |
| MVP-051 | Private deploy tooling | `create-user`, `db:backup`, [private-deploy.md](../how-to/private-deploy.md) |
| MVP-052 | Production auth rate limits | `app.ts` (login/register; import limiter when import returns) |
| FR-006 | Extended account types | `Account` model; allow-list in `domain/accountTypes.ts`; `/api/accounts`; `/accounts` UI type select — type-specific fields still planned |
| MVP-011 | Cash ledger INCOME/EXPENSE | `CashTransaction`; `domain/cashLedger.ts`; `/api/accounts/:id/transactions`; `/accounts/:id` |

## Planned / not in this codebase

| Area | Where to look |
|------|----------------|
| Password reset (MVP-003) | [mvp/features/auth/password-reset-api.md](../../mvp/features/auth/password-reset-api.md) |
| Transfers, categories, holdings, tax, import, FX, budgets, … | [mvp/CHECKLIST.md](../../mvp/CHECKLIST.md) |

Do not invent “implemented” rows for domain FRs until the feature ships and docs-sync updates this page.
