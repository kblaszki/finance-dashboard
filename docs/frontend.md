# Frontend

Stack: Vite + React + TypeScript. Entry: `frontend/src/main.tsx`, routes in [`frontend/src/App.tsx`](../frontend/src/App.tsx).

## Routes

| Path | Page | Key components |
|------|------|----------------|
| `/login` | Login | `pages/LoginPage.tsx` |
| `/register` | Register | `pages/RegisterPage.tsx` (username) |
| `/` | Dashboard | `DashboardPage`, `NetWorthSection`, charts |
| `/accounts` | Accounts | `ManagedAccountsList` |
| `/accounts/:id` | Account detail | `AccountDetailPage`, `AccountBalanceChart`, `HoldingLotsTable` |
| `/transactions` | Transactions | `TransactionsListPage` → `TransactionTable` |

Protected shell: `ProtectedRoute` → `AppShell`.

## State

| Module | Role |
|--------|------|
| `frontend/src/state/auth.tsx` | Session + `username` on register |
| `frontend/src/state/currency.tsx` | Display currency |
| `frontend/src/state/period.tsx` | Dashboard date range |

## API clients

| File | Backend prefix |
|------|----------------|
| `authApi.ts` | `/api/auth/*` |
| `accountsApi.ts` | `/api/accounts` |
| `transactionsApi.ts` | `/api/transactions` |
| `instrumentsApi.ts` | `/api/instruments` |
| `holdingLotsApi.ts` | `/api/accounts/:id/holding-lots` |
| `valuationsApi.ts` | holding valuations |
| `statsApi.ts` | `/api/stats/*` |

## Related docs

- [api.md](api.md) — REST catalog
- [plans/baza_danych/06-frontend-mvp.md](../plans/baza_danych/06-frontend-mvp.md) — MVP migration checklist
