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
  - frontend/src/api/instrumentsApi.ts
  - frontend/src/api/watchlistApi.ts
  - frontend/src/api/appConfigApi.ts
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
| `/dashboard` | Protected | `DashboardPage` (setup checklist when workspace incomplete; balanced layout: wealth hero with NBP mid rates + range delta + 6M/1Y/2Y chart, This-month KPIs with abs/% vs prev and CTAs to cashflow/ledger, top expense category bars + allocation grid, recent cash activity + uncategorized attention, demoted Ideas; pieces in `components/dashboard/`) |
| `/home` | Protected | Redirect → `/dashboard` |
| `/cashflow` | Protected | `StatisticsPage` (period → KPIs incl. savings ratio → category/tag horizontal bars → cashflow history → rolling-12m; soft CTAs to transfers/ledger; composed from `components/statistics/`); progressive `StatusBlock`s; KPIs/history/rolling use reporting-currency NBP FX with abs/% vs prev; category/tag stay single-currency (mismatch banner); helpers in `utils/statisticsPeriod.ts` / `statisticsRollup.ts` |
| `/statistics` | Protected | Redirect → `/cashflow` |
| `/wealth` | Protected | Redirect → `/accounts` |
| `/accounts` | Protected | Under `WealthLayout` (Accounts \| Markets tabs). `AccountsPage` (multi-type create/list/edit/delete; type filter All + allow-listed types; client column sort on Name/Equity (`totalEquity`); currency select is `PLN`/`EUR`/`USD` only; currency on edit is disabled once the ledger has rows) |
| `/accounts/:id` | Protected | Under `WealthLayout`. `AccountDetailPage` (balance history chart at top with cash / holdings / equity lines; for `BROKERAGE`/`IKE`/`IKZE`: `BrokerageHoldingsPanel` — holdings MTM + cost/unrealized P&L, trade form, recent trades; cash ledger with month / All-time pager + Load more + client filter bar; inline create row + list/delete/CSV; CSV import via `useCashLedgerImport`). Header **Transfer out** deep-links to `/transfers?fromAccountId=`. Subtitle shows cash / holdings / equity when present. Transfer legs (`transferId` set) are read-only. Ledger pieces in `components/account/` including `BrokerageHoldingsPanel` / `AccountBalanceChart`. |
| `/markets` | Protected | Under `WealthLayout`. `MarketsPage` — allowlist search + catalog “Add to markets” + watchlist; clients `instrumentsApi` / `watchlistApi`; seed via `market:seed-universe` |
| `/markets/:instrumentId` | Protected | Under `WealthLayout`. `InstrumentDetailPage` — EOD close chart (`fetchInstrumentHistory`); range 3/6/12 months or calendar-year pager (‹ ›); linked from watchlist symbols |
| `/organize` | Protected | Redirect → `/organize/categories` |
| `/organize/categories` | Protected | Under `OrganizeLayout` (Categories \| Tags). `CategoriesPage` (Income / Expense / Transfers sections; optional `?ledgerType=INCOME\|EXPENSE\|TRANSFER` scrolls/focuses that section; CSV Download/Upload merge import — preview summary then Confirm; create/row UI in `components/categories/{CategoryCreateRow,CategoryRow}`; sortable Name column; double-click Name/Parent + Enter to PATCH, Escape or blur cancels; delete; section fixes `ledgerType`; **Description rules** via `DescriptionRulesPanel`) |
| `/organize/tags` | Protected | Under `OrganizeLayout`. `TagsPage` (flat Name + Actions table; sortable Name; inline create; double-click name + Enter to rename; delete with confirm) |
| `/categories` | Protected | Redirect → `/organize/categories` |
| `/tags` | Protected | Redirect → `/organize/tags` |
| `/transfers` | Protected | Not in top nav (linked from Cashflow / account Transfer out). `TransfersPage` (uses `CurrencyProvider` accounts + `useTransferImport`; editable table in `components/transfers/TransferTable` + `TransferCreateRow`; month / All-time pager + Load more + client filter bar; client column sort on Date/amounts/Description; inline create with optional TRANSFER category; `?fromAccountId=` prefills From then clears via replace; CSV via `TransferImportPanel` — preview always returns `rows` (empty until mappings); double-click edit; amount-to editable only for cross-currency; delete with confirm; refreshes topbar balances) |
| `/settings` | Protected | `SettingsPage` — profile/email/password, appearance, **marketLiveApi** toggle (`appConfigApi`) |

Shell: `AppShell` — fixed sidebar (brand, icon nav ≤5: Dashboard · Cashflow · Wealth · Organize · Settings, user + logout, theme toggle) + topbar (one page `h1`, global `CurrencySelect`; when no accounts/currencies, a “Create an account” link to `/accounts` instead of an empty select) + content. Wealth nav is active on `/accounts` and `/markets`; Organize on `/organize/*`. A skip link targets `#main-content`. The sidebar becomes an off-canvas drawer (`.shell--drawer-mode`) when the viewport cannot fit the sticky sidebar beside the widest table’s readable minimum (`shellDrawerMode.ts`); pages without tables fall back to ≤900px. Open from the topbar menu button (backdrop / Escape / route change close it). Gate: `ProtectedRoute`. `ErrorBoundary` wraps the shell outlet and the guest auth outlet. Page titles inside the shell are `h2`.

Shared UI: `components/ui/{PageHeader,KpiCard,ChartCard,StatusBlock,CurrencySelect,SetupChecklist}.tsx`. `StatusBlock` uses `role="alert"` for errors and `role="status"` for loading and empty states. `SetupChecklist` guides empty workspaces (account → categories → first transaction).

Global currency: `state/currency.tsx` (`CurrencyProvider`) fetches accounts once, exposes `{ accounts, accountsError, accountsLoading, currencies, currency, setCurrency, refreshAccounts }`. Once any account exists, `currencies` is the NBP reporting whitelist `EUR`/`PLN`/`USD` (not only held account currencies). Selection persists under `localStorage` key `finance-dashboard:currency`. `TransfersPage` reuses that accounts list (no second fetch).

Auth: `AuthSwapShell` — 50/50 form + visual panel; register keeps form on the left, login swaps sides (`data-mode`). Fine grid on the visual pane; decorative chart cards. Gate: `GuestOnly` + `Outlet`.

Theme (`light` | `dark`) lives in `state/theme.tsx`, persisted under `localStorage` key `finance-dashboard:theme`. Applied as `document.documentElement.dataset.theme`. Missing, invalid, or legacy `system` values resolve once from `prefers-color-scheme` and are stored as explicit `light` or `dark`. FOUC bootstrap mirrors this in `frontend/index.html`.

Visual system (Signal focus): design tokens and layered CSS live under `frontend/src/styles/` (imported via `index.css` → `styles/index.css`). Layers: `tokens` → `base` → `layout` → `components` → `pages` → `utilities`. Tokens include colors (`--color-*`, `--color-border-subtle` / `--color-border-strong`, `--color-backdrop`, `--landing-grid-line`, `--sidebar-hover-bg`), typography (`--text-xs`…`--text-2xl`), weights, spacing (`--space-*`), `--sidebar-width`, `--tap-target`, `--chart-1…6`, chart plot heights (`--chart-h-sm/md/lg`), and stacking (`--z-skip` / `--z-topbar` / `--z-backdrop` / `--z-drawer` / `--z-popover` / sticky locals). Color literals (hex and rgba) belong only in `styles/tokens.css` (Stylelint bans hex outside tokens). UI font IBM Plex Sans; display/brand Space Grotesk (from `index.html`). Canonical viewport breakpoints: `40rem` / `64rem`; content max-width uses `80rem` (`.shell-content`). `.donut-layout` uses a container query at `28rem`. Shared chrome lives in `components/` (`feedback.css` banners/muted, `form.css` `.field-control` / `.auth-form` / `.form-grid`, `segmented.css`, `chart.css`). Production `/` landing uses the centered Signal-focus composition; authenticated shell uses sidebar/topbar; login/register use auth swap-split. Recharts series use `--chart-*` inside `.chart-plot--sm|md|lg` parents. Controls outside `.auth-form` / ledger cells use `.field-control` (filters, Markets search, brokerage trade form, MonthPager, chart range, statistics period).

### Table recipe

New list tables should follow this chrome so sticky/tap/edit stay consistent:

1. Wrap with `.table-wrap` → `<table className="data-table ledger-table">` for editable lists (ledger, transfers, categories, tags) and brokerage holdings/trades.
2. Column classes: `.col-date`, `.col-status`, `.col-text`, `.num`, `.col-actions`.
3. Create row stays first in `tbody`, outside client filter/sort of data rows.
4. Inline editors: `.ledger-cell--editable` + `.ledger-cell-input` (double-click → Enter save / Escape or blur cancel). Use `title="Double-click to edit"` on editable cells. Programmatic `focus({ preventScroll: true })` after create/edit — do **not** put tall multi-field forms in sticky `td:first-child` (Accounts edit uses a full-width `.account-edit-row` with `colSpan`).
5. Filter/tooling inputs outside cells: `.field-control` (not bare UA controls). Sort headers: `SortableTh` + `tableSort` util.
6. Sticky `thead` uses `top: 0` relative to `.table-wrap`’s scrollport (`overflow-x: auto`); first column sticks horizontally. Do not offset thead for the shell topbar — that scrollport is the wrap, not the viewport.

Forms on Settings and Accounts use the stack form class `.auth-form` (compact table edits: `.auth-form--compact`). Ledger create uses a top `.ledger-create-row` (same columns; Enter submits; default type = last type entered this session on the account, else newest ledger row, else `INCOME`). Ledger and transfer dates use `<input type="date">` (day precision); `occurredAt.ts` stores ISO at local noon (`dateInputToIso`) and displays with `formatOccurredAt` (no time). Ledger inline edits use `.ledger-cell--editable` / `.ledger-cell-input` (double-click a Date/Type/Amount/Category/Description cell, Enter to PATCH, Escape or blur to cancel). Feedback: `.error-banner` / `.auth-error` for failures, `.success-banner` for confirmations, `.empty-state` for empty lists. Destructive actions use `.btn-danger`. AppShell logout uses `.shell-logout` (distinct from `.theme-toggle`). Dashboard and Statistics KPIs use `.kpi-grid` / `.kpi-card` (`KpiCard`); charts use `.chart-card` / `.chart-container`.

Controls: `ThemeToggle` (light ↔ dark) on Landing, AuthSwapShell, and AppShell; Settings **Appearance** section sets theme via Light/Dark radios (`.appearance-option`). Global currency select lives in the shell topbar.

Default after login/register: `/dashboard` (`state/auth.tsx`).

Production Docker serves `frontend/dist` from Express (`STATIC_DIR`); deep links fall back to `index.html`. Vite `base` is `/`; API calls use relative `/api/...`.

## API clients

| Module | Role |
|--------|------|
| `frontend/src/api/client.ts` | `fetch` + Bearer token. Session `401` clears auth. Other errors use `body.error`. A failed `fetch` throws `Network request failed`. |
| `frontend/src/api/authApi.ts` | config, register, login, me, profile, email, password |
| `frontend/src/api/accountsApi.ts` | list/create/get/patch/delete accounts; `fetchAccountBalanceHistory`; `ACCOUNT_TYPES` / `supportsAssetTrades`; `ACCOUNT_CURRENCIES` (`PLN`\|`EUR`\|`USD`); equity fields `holdingsValue` / `totalEquity` |
| `frontend/src/api/holdingsApi.ts` | `fetchAccountHoldings` → `/api/accounts/:id/holdings` (includes `costBasis` / `averageCost` / `unrealizedPnl`) |
| `frontend/src/api/assetTradesApi.ts` | `fetchAssetTrades`, `createAssetTrade`, `deleteAssetTrade` → `/api/accounts/:id/asset-trades` |
| `frontend/src/api/categoriesApi.ts` | list/create/patch/delete + CSV export/preview/import → `/api/categories` (`exportCategoriesCsv`, `previewCategoriesImport`, `importCategoriesCsv`); `CategoryLedgerType` includes `TRANSFER`; `flattenCategoryTree` |
| `frontend/src/api/categoryDescriptionRulesApi.ts` | CRUD → `/api/category-description-rules` |
| `frontend/src/api/tagsApi.ts` | list/create/patch/delete → `/api/tags` |
| `frontend/src/api/transactionsApi.ts` | list/create/delete/export/import cash txs under `/api/accounts/:id/transactions` (optional `categoryId`, `tagIds`; `transferId` on rows; CSV export via `getBlob`; import preview/commit include `descriptionSuggestions` / `descriptionMappings`, `skippedTransfers` + `skippedDuplicates` / `duplicateCount`; flexible column map + account CSV presets) |
| `frontend/src/api/transfersApi.ts` | list/create/patch/delete + CSV export/preview/import → `/api/transfers` (`categoryId` on transfer DTOs; `exportTransfersCsv`, `previewTransfersImport`, `importTransfersCsv`) |
| `frontend/src/api/statisticsApi.ts` | `fetchCategoryBreakdown`, `fetchPeriodSummary`, `fetchTagBreakdown`, `fetchCashflowHistory`, `fetchNetWorth`, `fetchNetWorthHistory`, `fetchCashflowRolling12m`, `fetchRecentActivity` → `/api/statistics/*` (optional `period`; net-worth responses include `asOf` / `ratesUsed`) |
| `frontend/src/api/instrumentsApi.ts` | `searchInstruments`, `addInstrumentToAllowlist`, `fetchInstrumentHistory` → `/api/instruments` |
| `frontend/src/api/appConfigApi.ts` | `fetchAppConfig`, `updateAppConfig` → `/api/app-config` |
| `frontend/src/api/watchlistApi.ts` | `fetchWatchlist`, `addToWatchlist`, `removeFromWatchlist` → `/api/watchlist` |

New domain clients follow `frontend/src/api/*Api.ts` and must be covered in `apiModules.test.ts` when added.
