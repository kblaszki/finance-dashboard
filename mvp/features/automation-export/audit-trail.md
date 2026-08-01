---
id: NFR-003
status: done
domain: automation-export
title: Financial edit audit trail
---

# Financial edit audit trail

## Summary

Read-only audit log of create/update/delete snapshots.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /settings |

## Acceptance

- [ ] GET /api/audit-logs

## Implementation notes

- Docs: docs/how-to/data-export.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (when FR/NFR)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
