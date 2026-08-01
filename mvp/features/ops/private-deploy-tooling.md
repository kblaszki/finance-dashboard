---
id: MVP-051
status: done
domain: ops
title: Private deploy: create-user and backup
---

# Private deploy: create-user and backup

## Summary

ALLOW_REGISTER=false, create-user, db:backup with optional gzip.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | CLI |

## Acceptance

- [ ] create-user works
- [ ] backup file written

## Implementation notes

- Docs: docs/how-to/private-deploy.md, docs/reference/scripts.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (when FR/NFR)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
