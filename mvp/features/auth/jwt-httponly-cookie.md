---
id: MVP-004
status: planned
domain: auth
title: JWT in HttpOnly cookie
---

# JWT in HttpOnly cookie

## Summary

Keep the existing JWT model (MVP-001). Change only **transport**: stop storing the token in `localStorage` and sending `Authorization: Bearer`; set it as a `Secure` + `HttpOnly` + `SameSite=Lax` cookie instead. Do **not** introduce `express-session` or a session table.

## User value

An XSS bug in the SPA cannot read the token from JavaScript. Fits the private same-origin deploy (Express serves API + UI behind Caddy HTTPS + `trust proxy`).

## Current behavior (do not treat as the target)

| Piece | Today |
|-------|--------|
| Issue | `POST /api/auth/login` and `/register` return `{ token, user }` |
| Secret | `JWT_SECRET` (≥32 chars), 7-day expiry, no refresh tokens |
| Browser store | `localStorage` key `finance_dashboard_token` (`frontend/src/api/client.ts`) |
| API auth | `requireAuth` reads `Authorization: Bearer` (`backend/src/auth.ts`) |
| Logout | Client-only: `localStorage.removeItem`; no API |
| Cookie | None |

## Target

| Piece | After |
|-------|--------|
| Issue | Login/register set cookie (`Set-Cookie`); JSON may omit `token` (breaking for the SPA only) |
| Cookie | `HttpOnly; Secure; SameSite=Lax; Path=/`; `Max-Age` aligned with JWT (7d) |
| Name | Prefer `__Host-` prefix (`Secure`, `Path=/`, no `Domain`) when served over HTTPS |
| Read | `requireAuth` reads the cookie; optionally still accept `Authorization: Bearer` for HTTP tests / scripts |
| Frontend | `credentials: "include"` on `fetch`; delete token helpers / `localStorage` usage |
| Logout | `POST /api/auth/logout` clears the cookie; UI then navigates to `/login` |
| Proxy | Existing `trust proxy` must stay on in production so `Secure` cookies work behind Caddy (TLS terminated, Express sees HTTP) |

Same-origin + `SameSite=Lax` is enough CSRF mitigation for this app (no cookie sent on most cross-site POSTs). Do not add a CSRF token unless the UI and API split origins again.

## Surfaces

| Kind | Location |
|------|----------|
| API | `POST /api/auth/login`, `/register`; new `POST /api/auth/logout`; `requireAuth` |
| UI | Login/register/logout; `frontend/src/api/client.ts`, `authApi.ts`, `state/auth.tsx` |
| Code | `backend/src/auth.ts`, `authRoutes.ts`, `app.ts` (`trust proxy`) |

## Acceptance

- [ ] Token is not readable from JavaScript (`document.cookie` / `localStorage`)
- [ ] Cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`)
- [ ] Logged-out user cannot load financial API or UI data
- [ ] Deep-link refresh while logged in still works (cookie sent automatically)
- [ ] Production behind Caddy: cookie is set (requires `trust proxy`)
- [ ] HTTP tests still cover login + authenticated routes (cookie jar and/or leftover Bearer)

## Implementation notes

Primary code: [docs/meta/code-map.md](../../../docs/meta/code-map.md) (auth helpers, `authRoutes`, `client.ts`, `auth.tsx`).

When shipping, update in the same chunk: [docs/explanation/architecture.md](../../../docs/explanation/architecture.md), [docs/reference/api.md](../../../docs/reference/api.md) (logout + auth scheme), [docs/reference/frontend.md](../../../docs/reference/frontend.md), [docs/how-to/write-integration-tests.md](../../../docs/how-to/write-integration-tests.md). Keep env name **`JWT_SECRET`** (do not rename to `SESSION_SECRET`).

Frontend tests mock `setAuthToken` / `localStorage` — replace with `credentials` + 401 still clearing client auth state.

## Out of scope / follow-ups

- Server-side session store / `express-session` / SQLite session table
- Refresh tokens (still none; 7-day JWT)
- Password reset (MVP-003)
- Changing `JWT_SECRET` length or production `ALLOW_REGISTER` guards
