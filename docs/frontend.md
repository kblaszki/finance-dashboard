# Frontend

Stack: Vite + React + TypeScript. Entry: `frontend/src/main.tsx`, routes in [`frontend/src/App.tsx`](../frontend/src/App.tsx).

## Routes

| Path | Page | Key components |
|------|------|----------------|
| `/login` | Login | `pages/LoginPage.tsx` (guest only) |
| `/register` | Register | `pages/RegisterPage.tsx` (guest only) |
| `/` | Dashboard | `pages/DashboardPage.tsx`, charts, `NetWorthSection`, `MarketDataBanner` |
| `/accounts` | Accounts | `ManagedAccountsList` (bank + brokerage) |
| `/accounts/:id` | Account detail | `AccountDetailPage`, `AccountBalanceChart`, trades or bank txs |
| `/transactions` | Transactions | `TransactionsListPage` → `TransactionTable` |
| `/transactions/categories` | Categories | `CategoriesPage` → `CategoriesTable` |
| `/transactions/import` | CSV import | `ImportPage` → `CsvImportForm` |

Legacy redirects: `/portfolios`, `/portfolio`, `/categories`, `/import`, `/budgets` → new paths.

Protected shell: `ProtectedRoute` → `AppShell` (3 main nav items).

## State

| Module | Role |
|--------|------|
| `frontend/src/state/auth.tsx` | User session, token via `authApi` + `client.setAuthToken` |
| `frontend/src/state/currency.tsx` | Display currency for converted amounts |
| `frontend/src/state/period.tsx` | Dashboard date range (`PeriodProvider` on dashboard only) |
| `frontend/src/state/portfolio.tsx` | Active brokerage account id (legacy portfolio picker) |

## API clients

All HTTP goes through [`frontend/src/api/client.ts`](../frontend/src/api/client.ts).

| File | Backend prefix |
|------|----------------|
| `authApi.ts` | `/api/auth/*` |
| `transactionsApi.ts` | `/api/transactions` |
| `portfoliosApi.ts` | `/api/portfolios` (brokerage accounts alias) |
| `portfolioApi.ts` | `/api/portfolio`, `/api/market-data/refresh` |
| `accountsApi.ts` | `/api/accounts` (incl. `?scope=managed`, balance history) |
| `categoriesApi.ts` | `/api/categories` |
| `bondsApi.ts` | Bond holdings |
| `importApi.ts` | CSV import |
| `statsApi.ts` | `/api/stats/*` |

## UI conventions

- Format money/dates: `frontend/src/utils/format.ts`.
- Reuse layout classes from `App.css` / `index.css`.
- Product copy in UI is often Polish; project **documentation** is English.

## Related docs

- [api.md](api.md) — REST catalog
- [architecture.md](architecture.md) — auth and data flow
