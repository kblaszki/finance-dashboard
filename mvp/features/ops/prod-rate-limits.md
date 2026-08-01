---
id: MVP-052
status: done
domain: ops
title: Production auth and import rate limits
---

# Production auth and import rate limits

## Summary

Rate limit login/register/import when NODE_ENV=production.

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | app.ts (prod) |

## Acceptance

- [ ] Limiters mounted only in production

## Implementation notes

- Docs: docs/reference/environment.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (when FR/NFR)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
