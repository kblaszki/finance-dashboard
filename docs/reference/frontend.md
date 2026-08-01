---
diataxis: reference
use_when: Look up UI routes and API clients
audience: both
related_code:
  - frontend/src/App.tsx
  - frontend/src/api/authApi.ts
  - frontend/src/api/client.ts
---

# Frontend reference

Hub: [docs/README.md](../README.md).

## Routes

| Path | Access | Page |
|------|--------|------|
| `/` | Guest → Landing; authed → redirect `/home` | `LandingPage` / navigate |
| `/login` | Guest only | `LoginPage` |
| `/register` | Guest only (when `allowRegister`) | `RegisterPage` |
| `/home` | Protected | `HomePage` |
| `/settings` | Protected | `SettingsPage` |

Shell: `AppShell` (Home + Settings nav, theme, logout). Gate: `ProtectedRoute`.

Default after login/register: `/home` (`state/auth.tsx`).

## API clients

| Module | Role |
|--------|------|
| `frontend/src/api/client.ts` | `fetch` + Bearer token + 401 handler |
| `frontend/src/api/authApi.ts` | config, register, login, me, profile, email, password |

New domain clients follow `frontend/src/api/*Api.ts` and must be covered in `apiModules.test.ts` when added.
