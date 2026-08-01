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

Shell: `AppShell` (Home + Settings nav, theme cycle toggle, logout). Gate: `ProtectedRoute`.

Theme preference (`light` | `dark` | `system`) lives in `state/theme.tsx`, persisted under `localStorage` key `finance-dashboard:theme`. Resolved theme is applied as `document.documentElement.dataset.theme`. Missing/invalid storage defaults to `system` (follows `prefers-color-scheme`, including live OS changes). FOUC bootstrap mirrors this in `frontend/index.html`.

Controls: `ThemeToggle` (cycles light → dark → system) on Landing, Login, Register, and AppShell; Settings **Appearance** section sets preference explicitly via radios.

Default after login/register: `/home` (`state/auth.tsx`).

## API clients

| Module | Role |
|--------|------|
| `frontend/src/api/client.ts` | `fetch` + Bearer token + 401 handler |
| `frontend/src/api/authApi.ts` | config, register, login, me, profile, email, password |

New domain clients follow `frontend/src/api/*Api.ts` and must be covered in `apiModules.test.ts` when added.
