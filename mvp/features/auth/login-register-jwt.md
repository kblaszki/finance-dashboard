---
id: MVP-001
status: done
domain: auth
title: Login and register with JWT
---

# Login and register with JWT

## Summary

Email or username login; register when allowRegister; JWT session (7d).

## User value

Capability tracked in the product map for agents and humans; see linked docs for recipes.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /login, /register |

## Acceptance

- [ ] User can register when allowed
- [ ] User can log in and reach /dashboard

## Implementation notes

- Docs: docs/tutorials/first-run.md, docs/how-to/account-settings.md
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md) (when FR/NFR)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- Cookie transport (keep JWT, drop `localStorage`): [MVP-004](jwt-httponly-cookie.md)
- See related planned/stub rows in [CHECKLIST.md](../../CHECKLIST.md)
