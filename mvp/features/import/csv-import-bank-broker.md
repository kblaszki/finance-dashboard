---
id: FR-019
status: planned
domain: import
title: Bank and broker CSV import
---

# Bank and broker CSV import

## Summary

XTB broker + mBank/generic bank CSV with dry-run and idempotent commit.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /import |

## Acceptance

- [ ] Dry-run preview
- [ ] Commit creates ImportBatch rows

## Implementation notes

- Docs: docs/how-to/import-csv.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (when FR/NFR)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
