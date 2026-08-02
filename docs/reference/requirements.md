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

**Shipped in code** = auth + multi-type accounts + category tree + cash ledger (optional `categoryId`, CSV export) + statistics (category breakdown, period KPIs, cashflow history, cash net worth, rolling 12m averages) below. Remaining backlog: [mvp/CHECKLIST.md](../../mvp/CHECKLIST.md) and `mvp/features/*`. Checklist: 15 done / 0 in_progress / 48 planned (as of 2026-08-02).

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
| MVP-013 | Cash ledger CSV export | `GET /api/accounts/:id/transactions/export`; `domain/cashLedgerCsv.ts`; Download CSV on `/accounts/:id` |
| FR-015 | Category tree CRUD | `Category`; `domain/categories.ts`; `/api/categories`; `/categories`; defaults on register |
| FR-018 | Transaction categories | Optional `CashTransaction.categoryId` on ledger create/list; multi-line splits deferred |
| FR-016 | Category spend breakdown | `GET /api/statistics/category-breakdown`; `/statistics` month Income/Expense lists (UTC, no FX) |
| FR-003 | Statistics period cashflow summary | `GET /api/statistics/period-summary`; `/statistics` income/expense/net KPIs for one currency |
| FR-004 | Cashflow history chart | `GET /api/statistics/cashflow-history`; `/statistics` Recharts series (`months` 6\|12\|24) |
| FR-002 | Net worth (cash buckets) | `GET /api/statistics/net-worth`; `/dashboard` byBucket from `cashBalance` (liabilities 0; no holdings/FX) |
| FR-005 | Rolling 12-month cashflow averages | `GET /api/statistics/cashflow-rolling-12m`; `/dashboard` avg income/expense/net |

## Planned / not in this codebase

| Area | Where to look |
|------|----------------|
| Password reset (MVP-003) | [mvp/features/auth/password-reset-api.md](../../mvp/features/auth/password-reset-api.md) |
| Transfers, categories, holdings, tax, import, FX, budgets, … | [mvp/CHECKLIST.md](../../mvp/CHECKLIST.md) |

Do not invent “implemented” rows for domain FRs until the feature ships and docs-sync updates this page.
