---
id: MVP-052
status: done
domain: ops
title: Production auth and import rate limits
---

# Production auth and import rate limits

## Summary

Production rate limits on login/register are shipped (`NODE_ENV=production`). Import rate limiting returns when the import API is re-implemented.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | app.ts (prod) |

## Acceptance

- [x] Auth login/register limiters mounted only in production
- [ ] Import limiter (when import API exists)

## Implementation notes

- Docs: docs/reference/environment.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (when FR/NFR)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
