---
id: MVP-050
status: done
domain: ops
title: Health check with DB ping
---

# Health check with DB ping

## Summary

Liveness plus SQLite query.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | GET /api/health |

## Acceptance

- [ ] Returns ok/db flags

## Implementation notes

- Docs: docs/how-to/private-deploy.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (when FR/NFR)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
