---
diataxis: how-to
use_when: Update profile, email, or password; understand password-reset stub
audience: both
related_docs:
  - docs/tutorials/first-run.md
  - docs/how-to/private-deploy.md
  - docs/reference/environment.md
related_code:
  - frontend/src/pages/SettingsPage.tsx
  - backend/src/routes/authRoutes.ts
  - frontend/src/pages/PasswordResetPage.tsx
---

# Account settings (profile)

Hub: [docs/README.md](../README.md).

## Profile (`/settings`)

1. **Username** — form submits `PATCH`/`PUT` profile via `authApi.updateProfile`; refresh session after success.
2. **Email** — requires current password (`updateEmail`).
3. **Password** — current + new password (`updatePassword`); validation matches backend `validatePassword`.

Also on the same page: export / sync stubs / audit ([data-export.md](data-export.md), [account-sync.md](account-sync.md)) and document attachment metadata.

## Auth config

`GET /api/auth/config` returns `allowRegister`. When false, UI hides/redirects register ([environment.md](../reference/environment.md), [private-deploy.md](private-deploy.md)). Create users with CLI `create-user`.

## Password reset

`/password-reset` is a **stub page only** — no email API. Users change password while logged in under Settings, or an admin resets via DB/`create-user` for a new account.

## Landing / login

- `/` marketing landing (guests); authed users go to `/dashboard`.
- `/login` accepts email or username + password.
- First success path: [first-run.md](../tutorials/first-run.md).

| Area | Path |
|------|------|
| UI | `SettingsPage`, `LoginPage`, `RegisterPage`, `PasswordResetPage` |
| API | `/api/auth/me`, profile/email/password routes — [api.md](../reference/api.md) |
