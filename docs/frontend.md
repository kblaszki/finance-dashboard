# Frontend

Stack: Vite + React + TypeScript. Entry: `frontend/src/main.tsx`, routes in [`frontend/src/App.tsx`](../frontend/src/App.tsx).

## Routes

| Path | Page | Key components |
|------|------|----------------|
| `/login` | Login | `pages/LoginPage.tsx` (guest only) |
| `/register` | Register | `pages/RegisterPage.tsx` (guest only) |
| `/` | Dashboard | `PeriodFilter`, `KpiCards`, charts, `BudgetProgress` |
| `/transactions` | Transactions | `TransactionTable` |
| `/portfolio` | Portfolio | `PortfolioTable` |
| `/portfolio/:symbol` | Symbol analysis | `PortfolioPositionAnalysis` |
| `/budgets` | Budgets | `BudgetTable` |

Protected shell: `ProtectedRoute` → `AppShell` (sidebar nav, `CurrencySelect`, `ThemeToggle`, logout).

## State

| Module | Role |
|--------|------|
| `frontend/src/state/auth.tsx` | User session, token via `authApi` + `client.setAuthToken` |
| `frontend/src/state/currency.tsx` | Display currency for converted amounts |
| `frontend/src/state/period.tsx` | Dashboard date range (`PeriodProvider` on dashboard only) |

## API clients

All HTTP goes through [`frontend/src/api/client.ts`](../frontend/src/api/client.ts) (`VITE_API_BASE_URL`, Bearer token, 401 → logout handler).

| File | Backend prefix |
|------|----------------|
| `authApi.ts` | `/api/auth/*` |
| `transactionsApi.ts` | `/api/transactions` |
| `portfoliosApi.ts` | `/api/portfolios` |
| `portfolioApi.ts` | `/api/portfolio`, `/api/market-data/refresh` |
| `budgetsApi.ts` | `/api/budgets`, `/api/stats/budget-progress` |
| `statsApi.ts` | `/api/stats/*` |

## UI conventions

- Format money/dates: `frontend/src/utils/format.ts`.
- Reuse layout classes from `App.css` / `index.css`.
- Product copy in UI is often Polish; project **documentation** is English ([`.cursor/rules/markdown.mdc`](../.cursor/rules/markdown.mdc)).

## Adding a feature

1. Route in `App.tsx` (and nav `NavLink` in `AppShell` if top-level).
2. Component under `frontend/src/components/` or `pages/`.
3. API wrapper in `frontend/src/api/<feature>Api.ts`.
4. One row in [api.md](api.md) and this file’s tables.

## Related docs

- [api.md](api.md) — REST catalog
- [architecture.md](architecture.md) — auth and data flow
