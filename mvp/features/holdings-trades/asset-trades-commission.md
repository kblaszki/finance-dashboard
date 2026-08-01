---
id: FR-007
status: done
domain: holdings-trades
title: Asset trades with commission and settlementDate
---

# Asset trades with commission and settlementDate

## Summary

BUY/SELL lots with commission; optional settlementDate for tax year.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /transactions, lots |

## Acceptance

- [ ] POST /api/asset-trades
- [ ] Lots store commission

## Implementation notes

- Docs: docs/how-to/accounts-and-holdings.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (when FR/NFR)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
