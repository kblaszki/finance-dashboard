---
id: FR-014
status: done
domain: holdings-trades
title: Account-scoped holding detail
---

# Account-scoped holding detail

## Summary

KPIs, lot table, valuation chart, split, pre-sell.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /accounts/:id/assets/:instrumentId |

## Acceptance

- [ ] GET .../assets/:instrumentId summary

## Implementation notes

- Docs: docs/how-to/accounts-and-holdings.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (when FR/NFR)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
