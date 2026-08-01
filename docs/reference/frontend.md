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
| `/preview/home` | Temporary gallery | `HomePreviewIndexPage` |
| `/preview/home/:slug` | Temporary home layouts | `HomePreviewPage` |

Shell: `AppShell` (Home + Settings nav, theme toggle, logout). Gate: `ProtectedRoute`.

Theme (`light` | `dark`) lives in `state/theme.tsx`, persisted under `localStorage` key `finance-dashboard:theme`. Applied as `document.documentElement.dataset.theme`. Missing, invalid, or legacy `system` values resolve once from `prefers-color-scheme` and are stored as explicit `light` or `dark`. FOUC bootstrap mirrors this in `frontend/index.html`.

Visual system (Signal focus): slate + emerald tokens in `index.css`; UI font IBM Plex Sans; display/brand Space Grotesk (loaded from `index.html`). Production `/` landing uses the centered Signal-focus composition (brand, headline, lead, rule, CTAs, today/roadmap split) with a fine grid atmosphere.

Controls: `ThemeToggle` (light ↔ dark) on Landing, Login, Register, and AppShell; Settings **Appearance** section sets theme via Light/Dark radios.

Temporary home layout previews (`/preview/home`, `/preview/home/:slug`) use static Recharts demos; production `/home` is unchanged. Gallery groups: layout baselines, atmosphere (`grid-room`, `mesh-stage`, `dot-orbit`), and hatch family (`hatch-split`, `hatch-invert`, `hatch-ledge`, `hatch-triptych`, `hatch-spine`, `hatch-folio`, `hatch-ribbon`).

Default after login/register: `/home` (`state/auth.tsx`).

## API clients

| Module | Role |
|--------|------|
| `frontend/src/api/client.ts` | `fetch` + Bearer token + 401 handler |
| `frontend/src/api/authApi.ts` | config, register, login, me, profile, email, password |

New domain clients follow `frontend/src/api/*Api.ts` and must be covered in `apiModules.test.ts` when added.
