---
diataxis: how-to
use_when: Record mortgages, loans, or other liabilities and see net worth
audience: both
related_docs:
  - docs/reference/domain.md
  - docs/explanation/portfolio-stats.md
  - docs/how-to/dashboard-and-statistics.md
related_code:
  - backend/src/liabilities.ts
  - backend/src/routes/liabilitiesRoutes.ts
  - backend/src/netWorth.ts
  - frontend/src/pages/LiabilitiesPage.tsx
---

# Liabilities and net worth

Hub: [docs/README.md](../README.md).

Track debts and tax provisions so dashboard net worth = assets − liabilities (FR-029).

## Types

`liabilityType`: `mortgage` \| `loan` \| `credit` \| `tax_provision` \| `tax_advance` ([domain enums](../reference/domain.md#domain-enums-code-constants)).

Optional `accountId` links a liability to a user-owned account (e.g. mortgage tied to a REAL_ESTATE account) — link is informational; balance is always stored on the liability row.

## Steps

1. Open `/liabilities` (`LiabilitiesPage`).
2. Create: name, type, balance (≥ 0), currency, optional linked account.
3. Update or delete as balances change.
4. API: `GET/POST /api/liabilities`, `PUT/DELETE /api/liabilities/:id`.

## Effect on net worth

1. Dashboard `NetWorthSection` (and `GET /api/stats/net-worth`) sums asset buckets, then subtracts `sumUserLiabilitiesInCurrency`.
2. Liability balances convert via NBP FX (`fx.ts`) into the request display currency (dashboard PLN rollup uses PLN — FR-038).
3. Tax calendar copy may remind you to review `tax_provision` / `tax_advance` rows before filing.

Bucket math for **assets**: [portfolio-stats.md](../explanation/portfolio-stats.md). Dashboard UX: [dashboard-and-statistics.md](dashboard-and-statistics.md).

| Area | Path |
|------|------|
| Domain | `backend/src/liabilities.ts` |
| HTTP | `liabilitiesRoutes.ts` |
| Net worth | `netWorth.ts` |
| Client / UI | `liabilitiesApi.ts`, `LiabilitiesPage` |
