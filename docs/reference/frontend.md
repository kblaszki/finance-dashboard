---
diataxis: reference
use_when: Look up UI routes and API clients
audience: both
related_code:
  - frontend/src/App.tsx
  - frontend/src/api/authApi.ts
  - frontend/src/api/accountsApi.ts
  - frontend/src/api/categoriesApi.ts
  - frontend/src/api/tagsApi.ts
  - frontend/src/api/transactionsApi.ts
  - frontend/src/api/transfersApi.ts
  - frontend/src/api/statisticsApi.ts
  - frontend/src/api/client.ts
  - frontend/src/state/currency.tsx
  - frontend/src/styles/index.css
---

# Frontend reference

Hub: [docs/README.md](../README.md).

## Routes

| Path | Access | Page |
|------|--------|------|
| `/` | Guest → Landing; authed → redirect `/dashboard` | `LandingPage` / navigate |
| `/login` | Guest only | `LoginPage` (in `AuthSwapShell`) |
| `/register` | Guest only (when `allowRegister`) | `RegisterPage` (in `AuthSwapShell`) |
| `/dashboard` | Protected | `DashboardPage` (setup checklist when workspace incomplete; KPIs including liabilities when > 0, net-worth donut, 12m cashflow, account mix) |
| `/home` | Protected | Redirect → `/dashboard` |
| `/accounts` | Protected | `AccountsPage` (multi-type create/list/edit/delete; type filter All + allow-listed types; client column sort on Name/Balance; currency on edit is read-only once the ledger has rows) |
| `/accounts/:id` | Protected | `AccountDetailPage` (balance history chart at top; cash ledger with month / All-time pager + Load more + client filter bar; inline create row + list/delete/CSV; CSV import opens `ImportCategoryMappingPanel` when the file uses categories). Header **Transfer out** deep-links to `/transfers?fromAccountId=`. Client column sort on Date/Amount/Description (after filters). Subtitle and editable-cell `title` hint double-click editing. Transfer legs (`transferId` set) are read-only with `TRANSFER IN/OUT` badges and a link to `/transfers`. Ledger Tags column uses multi-select for `tagIds` (cash rows only). Category selects include “+ New category…” (`CategorySelectWithCreate`). Ledger pieces live in `components/account/`: `AccountBalanceChart`, `AccountLedgerHeader`, `AccountSubtitle`, `ImportCategoryMappingPanel`, `LedgerTable`, `LedgerCreateRow`, `CategorySelectWithCreate`, `LedgerFilterBar`, `occurredAt.ts`, `categoryScope.ts` (`categoryIdsForLedgerType`) |
| `/categories` | Protected | `CategoriesPage` (Income / Expense / Transfers sections; optional `?ledgerType=INCOME\|EXPENSE\|TRANSFER` scrolls/focuses that section; CSV Download/Upload merge import — preview summary then Confirm; inline create row; sortable Name column; double-click Name/Parent + Enter to PATCH, Escape or blur cancels; delete; section fixes `ledgerType`) |
| `/tags` | Protected | `TagsPage` (flat Name + Actions table; sortable Name; inline create; double-click name + Enter to rename; delete with confirm) |
| `/transfers` | Protected | `TransfersPage` (month / All-time pager + Load more + client filter bar; client column sort on Date/amounts/Description; inline create row with optional TRANSFER category; `?fromAccountId=` prefills From then clears via replace; CSV Download/Upload with `TransferImportPanel` for account mapping + duplicate review; page subtitle + cell `title` hint double-click editing; double-click Date/From/To/amounts/category/description + Enter to PATCH, Escape or blur cancels; amount-to editable only for cross-currency; delete with confirm; refreshes topbar balances) |
| `/statistics` | Protected | `StatisticsPage` (month/quarter/year period, KPIs incl. transfers with % vs previous period via second `period-summary` fetch, cashflow chart, Categories/Tags breakdowns) |
| `/settings` | Protected | `SettingsPage` |

Shell: `AppShell` — fixed sidebar (brand, icon nav, user + logout, theme toggle) + topbar (one page `h1`, global `CurrencySelect`; when no accounts/currencies, a “Create an account” link to `/accounts` instead of an empty select) + content. A skip link targets `#main-content`. The sidebar becomes an off-canvas drawer (`.shell--drawer-mode`) when the viewport cannot fit the sticky sidebar beside the widest table’s readable minimum (`shellDrawerMode.ts`); pages without tables fall back to ≤900px. Open from the topbar menu button (backdrop / Escape / route change close it). Gate: `ProtectedRoute`. `ErrorBoundary` wraps the shell outlet and the guest auth outlet. Page titles inside the shell are `h2`.

Shared UI: `components/ui/{PageHeader,KpiCard,ChartCard,StatusBlock,CurrencySelect,SetupChecklist}.tsx`. `StatusBlock` uses `role="alert"` for errors and `role="status"` for loading and empty states. `SetupChecklist` guides empty workspaces (account → categories → first transaction).

Global currency: `state/currency.tsx` (`CurrencyProvider`) fetches accounts once, exposes `{ accounts, currencies, currency, setCurrency, refreshAccounts }`, persists selection under `localStorage` key `finance-dashboard:currency`.

Auth: `AuthSwapShell` — 50/50 form + visual panel; register keeps form on the left, login swaps sides (`data-mode`). Fine grid on the visual pane; decorative chart cards. Gate: `GuestOnly` + `Outlet`.

Theme (`light` | `dark`) lives in `state/theme.tsx`, persisted under `localStorage` key `finance-dashboard:theme`. Applied as `document.documentElement.dataset.theme`. Missing, invalid, or legacy `system` values resolve once from `prefers-color-scheme` and are stored as explicit `light` or `dark`. FOUC bootstrap mirrors this in `frontend/index.html`.

Visual system (Signal focus): design tokens and layered CSS live under `frontend/src/styles/` (imported via `index.css` → `styles/index.css`). Layers: `tokens` → `base` → `layout` → `components` → `pages` → `utilities`. Tokens include colors (`--color-*`, `--color-border-subtle` / `--color-border-strong`), typography scale (`--text-xs`…`--text-2xl`), weights, spacing (`--space-*`), `--sidebar-width`, `--shell-topbar-offset`, `--tap-target`, and `--chart-1…6`. Hex literals belong only in `styles/tokens.css` (enforced by Stylelint). UI font IBM Plex Sans; display/brand Space Grotesk (from `index.html`). Canonical viewport breakpoints: `40rem` / `64rem` / `80rem`; `.dash-grid` / `.donut-layout` also use container queries. Production `/` landing uses the centered Signal-focus composition; authenticated shell uses sidebar/topbar; login/register use auth swap-split. Recharts series use `--chart-*`. Controls outside `.auth-form` / ledger cells use `.field-control` (filters, import selects, MonthPager, chart range).

### Table recipe

New list tables should follow this chrome so sticky/tap/edit stay consistent:

1. Wrap with `.table-wrap` → `<table className="data-table ledger-table">` for editable lists (ledger, transfers, categories, tags).
2. Column classes: `.col-date`, `.col-status`, `.col-text`, `.num` / `.col-num`, `.col-actions`.
3. Create row stays first in `tbody`, outside client filter/sort of data rows.
4. Inline editors: `.ledger-cell--editable` + `.ledger-cell-input` (double-click → Enter save / Escape or blur cancel). Use `title="Double-click to edit"` on editable cells. Programmatic `focus({ preventScroll: true })` after create/edit — do **not** put tall multi-field forms in sticky `td:first-child` (Accounts edit uses a full-width `.account-edit-row` with `colSpan`).
5. Filter/tooling inputs outside cells: `.field-control` (not bare UA controls). Sort headers: `SortableTh` + `tableSort` util.
6. Sticky `thead` uses `top: var(--shell-topbar-offset)`; first column sticks horizontally inside `.table-wrap`.

Forms on Settings and Accounts use the stack form class `.auth-form` (compact table edits: `.auth-form--compact`). Ledger create uses a top `.ledger-create-row` (same columns; Enter submits; default type = last type entered this session on the account, else newest ledger row, else `INCOME`). Ledger and transfer dates use `<input type="date">` (day precision); `occurredAt.ts` stores ISO at local noon (`dateInputToIso`) and displays with `formatOccurredAt` (no time). Ledger inline edits use `.ledger-cell--editable` / `.ledger-cell-input` (double-click a Date/Type/Amount/Category/Description cell, Enter to PATCH, Escape or blur to cancel). Feedback: `.error-banner` / `.auth-error` for failures, `.success-banner` for confirmations, `.empty-state` for empty lists. Destructive actions use `.btn-danger`. AppShell logout uses `.shell-logout` (distinct from `.theme-toggle`). Dashboard and Statistics KPIs use `.kpi-grid` / `.kpi-card` (`KpiCard`); charts use `.chart-card` / `.chart-container`.

Controls: `ThemeToggle` (light ↔ dark) on Landing, AuthSwapShell, and AppShell; Settings **Appearance** section sets theme via Light/Dark radios (`.appearance-option`). Global currency select lives in the shell topbar.

Default after login/register: `/dashboard` (`state/auth.tsx`).

Production Docker serves `frontend/dist` from Express (`STATIC_DIR`); deep links fall back to `index.html`. Vite `base` is `/`; API calls use relative `/api/...`.

## API clients

| Module | Role |
|--------|------|
| `frontend/src/api/client.ts` | `fetch` + Bearer token. Session `401` clears auth. Other errors use `body.error`. A failed `fetch` throws `Network request failed`. |
| `frontend/src/api/authApi.ts` | config, register, login, me, profile, email, password |
| `frontend/src/api/accountsApi.ts` | list/create/get/patch/delete accounts; `fetchAccountBalanceHistory`; `ACCOUNT_TYPES` / `AccountType` / `accountTypeLabel` |
| `frontend/src/api/categoriesApi.ts` | list/create/patch/delete + CSV export/preview/import → `/api/categories` (`exportCategoriesCsv`, `previewCategoriesImport`, `importCategoriesCsv`); `CategoryLedgerType` includes `TRANSFER`; `flattenCategoryTree` |
| `frontend/src/api/tagsApi.ts` | list/create/patch/delete → `/api/tags` |
| `frontend/src/api/transactionsApi.ts` | list/create/delete/export/import cash txs under `/api/accounts/:id/transactions` (optional `categoryId`, `tagIds`; `transferId` on rows; CSV export via `getBlob`; import preview `{ csv }` → categories + `skippedTransfers`; import `{ csv, categoryMappings }` → `{ created, createdCategories, skipped, skippedTransfers }`) |
| `frontend/src/api/transfersApi.ts` | list/create/patch/delete + CSV export/preview/import → `/api/transfers` (`categoryId` on transfer DTOs; `exportTransfersCsv`, `previewTransfersImport`, `importTransfersCsv`) |
| `frontend/src/api/statisticsApi.ts` | `fetchCategoryBreakdown`, `fetchPeriodSummary`, `fetchTagBreakdown`, `fetchCashflowHistory`, `fetchNetWorth`, `fetchCashflowRolling12m` → `/api/statistics/*` (optional `period`) |

New domain clients follow `frontend/src/api/*Api.ts` and must be covered in `apiModules.test.ts` when added.
