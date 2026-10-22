---
id: FR-012
status: done
domain: accounts
title: Accounts list with type filter
---

# Accounts list with type filter

## Summary

List accounts with totalBalance, filter by account type, open detail.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /accounts |

## Acceptance

- [x] GET /api/accounts includes totalBalance
- [x] `/accounts` UI filters the list by `accountType` (All + each allow-listed type)

## Implementation notes

- UI: `frontend/src/pages/AccountsPage.tsx` (`filterAccountsByType`)
- Docs: docs/how-to/accounts-and-holdings.md (if present)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- Server-side type query (not needed for household scale)
