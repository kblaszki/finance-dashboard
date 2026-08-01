---
id: FR-002
status: planned
domain: dashboard-stats
title: Net worth with five asset buckets
---

# Net worth with five asset buckets

## Summary

Assets by cash/stock/crypto/metal/real_estate minus liabilities.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | Dashboard NetWorthSection |

## Acceptance

- [ ] GET /api/stats/net-worth returns byBucket and liabilities

## Implementation notes

- Docs: docs/explanation/portfolio-stats.md, docs/how-to/liabilities.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (when FR/NFR)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
