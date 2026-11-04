---
id: MVP-004
status: done
domain: auth
title: JWT in HttpOnly cookie
---

# JWT in HttpOnly cookie

## Summary

Keep the existing JWT model (MVP-001). Change only **transport**: stop storing the token in `localStorage` and sending `Authorization: Bearer` from the SPA; set it as a `Secure` + `HttpOnly` + `SameSite=Lax` cookie instead. Do **not** introduce `express-session` or a session table.

## User value

An XSS bug in the SPA cannot read the token from JavaScript. Fits the private same-origin deploy (Express serves API + UI behind Caddy HTTPS + `trust proxy`).

## Surfaces

| Kind | Location |
|------|----------|
| API | `POST /api/auth/login`, `/register`; `POST /api/auth/logout`; `requireAuth` (cookie then Bearer) |
| UI | Login/register/logout; `frontend/src/api/client.ts`, `authApi.ts`, `state/auth.tsx` |
| Code | `backend/src/auth.ts`, `authCookie.ts`, `authRoutes.ts`, `app.ts` (`cookie-parser`, `trust proxy`), `httpConfig.ts` (CORS credentials) |

## Acceptance

- [x] Token is not readable from JavaScript (`document.cookie` / `localStorage`)
- [x] Cookie flags: `HttpOnly`, `SameSite=Lax`; `Secure` (+ `__Host-` name) when HTTPS/production
- [x] Logged-out user cannot load financial API or UI data
- [x] Deep-link refresh while logged in still works (cookie sent automatically)
- [x] Production behind Caddy: cookie is set (requires `trust proxy`)
- [x] HTTP tests cover login + authenticated routes (Bearer via harness `signToken` + cookie agent tests)

## Implementation notes

Primary code: [docs/meta/code-map.md](../../../docs/meta/code-map.md). Docs: [architecture.md](../../../docs/explanation/architecture.md), [api.md](../../../docs/reference/api.md), [frontend.md](../../../docs/reference/frontend.md), [write-integration-tests.md](../../../docs/how-to/write-integration-tests.md).

## Out of scope / follow-ups

- Server-side session store / `express-session` / SQLite session table
- Refresh tokens (still none; 7-day JWT)
- Password reset (MVP-003)
- Changing `JWT_SECRET` length or production `ALLOW_REGISTER` guards
