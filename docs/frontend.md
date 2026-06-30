# Frontend

Stack: Vite + React + TypeScript. Entry: `frontend/src/main.tsx`, routes in [`frontend/src/App.tsx`](../frontend/src/App.tsx).

## Routes

| Path | Page | Key components |
|------|------|----------------|
| `/` | Landing (guests) | `pages/LandingPage.tsx` — marketing; authed users redirect to `/dashboard` |
| `/login` | Login | `pages/LoginPage.tsx` — email or username |
| `/register` | Register | `pages/RegisterPage.tsx` (username) |
| `/password-reset` | Password reset stub | `pages/PasswordResetPage.tsx` |
| `/dashboard` | Dashboard | `DashboardPage` — Portfolio / Budget tabs, `NetWorthSection`, portfolio & budget charts |
| `/statistics` | Statistics (placeholder) | `PlaceholderPage` — FR-003/004 pending |
| `/portfolio` | Portfolio (placeholder) | `PlaceholderPage` — FR-008 pending |
| `/accounts` | Accounts | `ManagedAccountsList` |
| `/accounts/:id` | Account detail | `AccountDetailPage`, `BrokerImportForm` (BROKERAGE), holdings, `ManualAccountRevalueForm` (MANUAL), `TransactionTable` |
| `/accounts/:id/holdings/:holdingId` | Holding detail | `HoldingDetailPage`, `HoldingValuationChart`, `InstrumentValuationForm`, `HoldingSplitForm`, `HoldingLotsTable` |
| `/transactions` | Transactions | `TransactionsListPage` → `TransactionTable` (`?accountId=` filter) |
| `/transfers` | Transfers (placeholder) | `PlaceholderPage` — FR-011 pending |
| `/tax` | PL tax report | `TaxReportPage` — FIFO gains, Belka estimate, CSV export |
| `/settings` | Account settings | `SettingsPage` — username, email, password |

Protected shell: `ProtectedRoute` → `AppShell`.

## State

| Module | Role |
|--------|------|
| `frontend/src/state/auth.tsx` | Session + `username` on register |
| `frontend/src/state/currency.tsx` | Display currency |
| `frontend/src/state/theme.tsx` | Light/dark theme |
| `frontend/src/state/period.tsx` | Dashboard date range (`PeriodProvider` on dashboard only) |
| `frontend/src/state/cashflow.tsx` | Dashboard cashflow stats (`CashFlowProvider`; uses `useAsyncData`) |

Preferred async pattern for page/widget data: [`frontend/src/hooks/useAsyncData.ts`](../frontend/src/hooks/useAsyncData.ts).

## API clients

| File | Backend prefix |
|------|----------------|
| `authApi.ts` | `/api/auth/*` |
| `accountsApi.ts` | `/api/accounts` |
| `transactionsApi.ts` | `/api/transactions` |
| `instrumentsApi.ts` | `/api/instruments`, `/api/instruments/:id/valuations` |
| `importApi.ts` | `POST /api/import/broker-trades` — XTB CSV dry-run / import |
| `holdingsApi.ts` | `/api/accounts/:id/holdings`, `/api/holdings/:holdingId`, `POST .../split` |
| `holdingLotsApi.ts` | `/api/holdings/:holdingId/lots` |
| `valuationsApi.ts` | `/api/accounts/:id/holdings/:instrumentId/valuations` — fetched in `HoldingDetailPage` for `HoldingValuationChart` |
| `statsApi.ts` | `/api/stats/*` including `tax-report` |
| `taxReportApi.ts` | CSV download for tax report |
| `marketDataApi.ts` | `/api/market-data/*` |

## Related docs

- [api.md](api.md) — REST catalog
- [README.md](../README.md) — setup and demo login

## Styling

Global CSS only — no CSS modules or utility framework.

| File | Role |
|------|------|
| `frontend/src/index.css` | Design tokens (`--color-*`, `--space-*`, `--chart-*`), light/dark via `[data-theme='dark']` |
| `frontend/src/App.css` | Layout shell, cards, tables, forms, buttons, charts, breakpoints |

**Breakpoints:** 480px, 768px, 900px, 1024px (mobile-first overrides in `App.css`).

**Class conventions:**

| Class | Use |
|-------|-----|
| `btn-primary` | Primary actions (submit, add) |
| `btn-link` / `btn-link danger` | Text actions (delete) |
| `inline-form` | Horizontal wrap forms with themed inputs |
| `table-wrap` | Horizontal scroll wrapper for wide tables on mobile |
| `card` | Elevated content panel |
| `muted` | Secondary text |
| `error-banner` | Form/page-level errors |
| `stack-md` / `form-section-gap` | Vertical spacing utilities |
