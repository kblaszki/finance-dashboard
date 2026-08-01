---
diataxis: how-to
use_when: Update profile, email, or password
audience: both
related_docs:
  - docs/tutorials/first-run.md
  - docs/how-to/private-deploy.md
  - docs/reference/environment.md
related_code:
  - frontend/src/pages/SettingsPage.tsx
  - backend/src/routes/authRoutes.ts
---

# Account settings (profile)

Hub: [docs/README.md](../README.md).

## Profile (`/settings`)

1. **Username** — `authApi.updateProfile` → `PATCH /api/auth/profile`; refresh session after success.
2. **Email** — requires current password (`updateEmail` → `PATCH /api/auth/email`).
3. **Password** — current + new (`updatePassword` → `PATCH /api/auth/password`); min length 8.

## Auth config

`GET /api/auth/config` returns `allowRegister`. When false, UI hides register ([environment.md](../reference/environment.md), [private-deploy.md](private-deploy.md)). Create users with `npm run create-user`.

## Landing / login

- `/` — marketing landing for guests; authed users redirect to `/dashboard`.
- `/login` — email or username + password.
- `/register` — when registration is allowed.
- First success: [first-run.md](../tutorials/first-run.md).

| Area | Path |
|------|------|
| UI | `SettingsPage`, `LoginPage`, `RegisterPage`, `DashboardPage`, `LandingPage` |
| API | [api.md](../reference/api.md) auth routes |
