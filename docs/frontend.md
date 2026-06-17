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
