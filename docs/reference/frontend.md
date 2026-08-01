---
diataxis: reference
use_when: Look up UI routes and API clients
audience: both
related_code:
  - frontend/src/App.tsx
  - frontend/src/api/authApi.ts
  - frontend/src/api/accountsApi.ts
  - frontend/src/api/categoriesApi.ts
  - frontend/src/api/transactionsApi.ts
  - frontend/src/api/statisticsApi.ts
  - frontend/src/api/client.ts
---

# Frontend reference

Hub: [docs/README.md](../README.md).

## Routes

| Path | Access | Page |
|------|--------|------|
| `/` | Guest → Landing; authed → redirect `/home` | `LandingPage` / navigate |
| `/login` | Guest only | `LoginPage` (in `AuthSwapShell`) |
| `/register` | Guest only (when `allowRegister`) | `RegisterPage` (in `AuthSwapShell`) |
| `/home` | Protected | `HomePage` |
| `/accounts` | Protected | `AccountsPage` (multi-type create/list/edit/delete) |
| `/accounts/:id` | Protected | `AccountDetailPage` (cash ledger create/list/delete; optional category) |
| `/categories` | Protected | `CategoriesPage` (nested tree create/rename/reparent/delete) |
| `/statistics` | Protected | `StatisticsPage` (period KPIs + cashflow chart for one currency; category breakdown for all currencies) |
| `/settings` | Protected | `SettingsPage` |

Shell: `AppShell` — hatch-folio layout (diagonal hatch atmosphere, asymmetric mast + page). Mast: brand, Home/Accounts/Categories/Statistics/Settings nav, user, `.app-folio-logout`, theme toggle. Gate: `ProtectedRoute`.

Auth: `AuthSwapShell` — 50/50 form + visual panel; register keeps form on the left, login swaps sides (`data-mode`). Fine grid on the visual pane; decorative chart cards. Gate: `GuestOnly` + `Outlet`.

Theme (`light` | `dark`) lives in `state/theme.tsx`, persisted under `localStorage` key `finance-dashboard:theme`. Applied as `document.documentElement.dataset.theme`. Missing, invalid, or legacy `system` values resolve once from `prefers-color-scheme` and are stored as explicit `light` or `dark`. FOUC bootstrap mirrors this in `frontend/index.html`.

Visual system (Signal focus): slate + emerald tokens in `index.css` (including `--color-warning`, `--color-positive-subtle`, `--focus-ring`); UI font IBM Plex Sans; display/brand Space Grotesk (loaded from `index.html`). Production `/` landing uses the centered Signal-focus composition (brand, headline, lead, rule, CTAs, today/roadmap split) with a fine grid atmosphere. Authenticated shell uses hatch-folio (diagonal hatch + 38/62 mast/page). Login/register use auth swap-split.

Forms on Settings and Accounts use the stack form class `.auth-form` (compact table edits: `.auth-form--compact`). Feedback: `.error-banner` / `.auth-error` for failures, `.success-banner` for confirmations, `.empty-state` for empty lists. Destructive actions use `.btn-danger`. AppShell logout uses `.app-folio-logout` (distinct from `.theme-toggle`). Home uses honest action cards (`.home-action-grid` / `.home-action-card`) linking to Accounts and Settings — no fake metrics.

Controls: `ThemeToggle` (light ↔ dark) on Landing, AuthSwapShell, and AppShell; Settings **Appearance** section sets theme via Light/Dark radios (`.appearance-option`).

Default after login/register: `/home` (`state/auth.tsx`).

## API clients

| Module | Role |
|--------|------|
| `frontend/src/api/client.ts` | `fetch` + Bearer token + 401 handler |
| `frontend/src/api/authApi.ts` | config, register, login, me, profile, email, password |
| `frontend/src/api/accountsApi.ts` | list/create/get/patch/delete accounts; `ACCOUNT_TYPES` / `AccountType` |
| `frontend/src/api/categoriesApi.ts` | list/create/patch/delete categories; `flattenCategoryTree` |
| `frontend/src/api/transactionsApi.ts` | list/create/delete cash txs under `/api/accounts/:id/transactions` (optional `categoryId`) |
| `frontend/src/api/statisticsApi.ts` | `fetchCategoryBreakdown`, `fetchPeriodSummary`, `fetchCashflowHistory` → `/api/statistics/*` |

New domain clients follow `frontend/src/api/*Api.ts` and must be covered in `apiModules.test.ts` when added.
