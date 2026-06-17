# Frontend

Stack: Vite + React + TypeScript. Entry: `frontend/src/main.tsx`, routes in [`frontend/src/App.tsx`](../frontend/src/App.tsx).

## Routes

| Path | Page | Key components |
|------|------|----------------|
| `/login` | Login | `pages/LoginPage.tsx` |
| `/register` | Register | `pages/RegisterPage.tsx` (username) |
| `/` | Dashboard | `DashboardPage`, `NetWorthSection`, charts |
| `/accounts` | Accounts | `ManagedAccountsList` |
| `/accounts/:id` | Account detail | `AccountDetailPage`, `AccountBalanceChart`, `HoldingValuationChart`, `HoldingLotsTable` |
| `/transactions` | Transactions | `TransactionsListPage` → `TransactionTable` |

Protected shell: `ProtectedRoute` → `AppShell`.

## State

| Module | Role |
|--------|------|
| `frontend/src/state/auth.tsx` | Session + `username` on register |
| `frontend/src/state/currency.tsx` | Display currency |
| `frontend/src/state/theme.tsx` | Light/dark theme |
| `frontend/src/state/period.tsx` | Dashboard date range (`PeriodProvider` on dashboard only) |

## API clients

| File | Backend prefix |
|------|----------------|
| `authApi.ts` | `/api/auth/*` |
| `accountsApi.ts` | `/api/accounts` |
| `transactionsApi.ts` | `/api/transactions` |
| `instrumentsApi.ts` | `/api/instruments` |
| `holdingLotsApi.ts` | `/api/accounts/:id/holding-lots` |
| `valuationsApi.ts` | `/api/accounts/:id/holdings/:instrumentId/valuations` — used by `HoldingValuationChart` on brokerage account detail |
| `statsApi.ts` | `/api/stats/*` |

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
