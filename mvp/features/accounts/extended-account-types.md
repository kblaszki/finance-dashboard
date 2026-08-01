---
id: FR-006
status: in_progress
domain: accounts
title: Extended account types
---

# Extended account types

## Summary

BANK, BROKERAGE, CRYPTO, PRECIOUS_METAL, REAL_ESTATE, OTHER, legacy MANUAL.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /accounts create |

## Acceptance

- [x] Create BANK account (CRUD + list UI)
- [ ] Create account with each remaining type

## Implementation notes

- Docs: [docs/reference/domain.md](../../../docs/reference/domain.md), [docs/reference/api.md](../../../docs/reference/api.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)
- Create API currently rejects non-BANK `accountType`

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
