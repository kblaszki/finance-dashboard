---
id: FR-006
status: done
domain: accounts
title: Extended account types
---

# Extended account types

## Summary

Allow-listed `accountType` values: BANK, BROKERAGE, CRYPTO, PRECIOUS_METAL, REAL_ESTATE, CREDIT_CARD, IKE, IKZE, TREASURY_BONDS, OTHER, legacy MANUAL.

## User value

Classify accounts for net-worth buckets and future tax / holdings rules without a Prisma enum migration.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /accounts create |

## Acceptance

- [x] Create BANK account (CRUD + list UI)
- [x] Create account with each remaining type
- [x] CREDIT_CARD signed balance (negative = debt) contributes to net-worth `liabilities`
- [x] IKE / IKZE map to stock bucket; TREASURY_BONDS to other (cash sleeve only for now)

## Implementation notes

- Docs: [docs/reference/domain.md](../../../docs/reference/domain.md), [docs/reference/api.md](../../../docs/reference/api.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)
- Allow-list: `backend/src/domain/accountTypes.ts`; create UI type select on `/accounts` (`accountTypeLabel`)
- Net worth: `backend/src/domain/netWorth.ts`
- Type-specific fields (grams, property, bond holdings, IKE/IKZE tax rules) remain follow-ups

## Out of scope / follow-ups

- Debit cards as separate entities (stay on BANK)
- Credit-card limits / billing cycles / interest
- Bond / IKE / IKZE holdings
- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
