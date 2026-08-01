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

Shell: `AppShell` (Home + Settings nav, theme toggle, logout). Gate: `ProtectedRoute`.

Theme (`light` | `dark`) lives in `state/theme.tsx`, persisted under `localStorage` key `finance-dashboard:theme`. Applied as `document.documentElement.dataset.theme`. Missing, invalid, or legacy `system` values resolve once from `prefers-color-scheme` and are stored as explicit `light` or `dark`. FOUC bootstrap mirrors this in `frontend/index.html`.

Controls: `ThemeToggle` (light ↔ dark) on Landing, Login, Register, AppShell, and temporary `/preview` gallery/chrome; Settings **Appearance** section sets theme via Light/Dark radios.

Temporary landing previews (`/preview`, `/preview/:slug`) use scoped CSS that follows the same global `data-theme` (light and dark palettes per variant). Gallery includes concept variants, Signal family siblings (`signal`, `signal-focus`, `signal-depth`, `signal-quiet`, `signal-edge`), and finance-visual ones (`ticker`, `folio`, `pulse`) with static Recharts demos. Production `/` landing is unchanged.

Default after login/register: `/home` (`state/auth.tsx`).

## API clients

| Module | Role |
|--------|------|
| `frontend/src/api/client.ts` | `fetch` + Bearer token + 401 handler |
| `frontend/src/api/authApi.ts` | config, register, login, me, profile, email, password |

New domain clients follow `frontend/src/api/*Api.ts` and must be covered in `apiModules.test.ts` when added.
