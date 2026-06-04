# Frontend

Stack: Vite + React + TypeScript. Entry: `frontend/src/main.tsx`, routes in [`frontend/src/App.tsx`](../frontend/src/App.tsx).

## Routes

| Path | Page | Key components |
|------|------|----------------|
| `/login` | Login | `pages/LoginPage.tsx` (guest only) |
| `/register` | Register | `pages/RegisterPage.tsx` (guest only) |
| `/` | Dashboard | `MarketDataBanner`, `NetWorthSection`, `KpiCards`, `PortfolioValueChart`, cashflow charts, `BudgetProgress` |
| `/transactions` | Transactions | `TransactionTable` (category tree, bank account warning) |
| `/portfolios` | All broker accounts | `AllPortfoliosTable` |
| `/portfolio` | Single portfolio | `PortfolioTable` |
| `/portfolio/trades` | Trade list (edit/delete) | `PortfolioTradesTable` |
| `/portfolio/:symbol` | Symbol analysis | `PortfolioPositionAnalysis` |
| `/accounts` | Financial accounts | `AccountsTable` |
| `/categories` | Category tree | `CategoriesTable` |
| `/import` | CSV import | `CsvImportForm`, `BrokerCsvImportForm` (bank presets + broker trades) |
| `/budgets` | Budgets | `BudgetTable` (root expense category select) |

Protected shell: `ProtectedRoute` → `AppShell` (sidebar nav, `CurrencySelect`, `ThemeToggle`, logout).

## State

| Module | Role |
|--------|------|
| `frontend/src/state/auth.tsx` | User session, token via `authApi` + `client.setAuthToken` |
| `frontend/src/state/currency.tsx` | Display currency for converted amounts |
| `frontend/src/state/period.tsx` | Dashboard date range (`PeriodProvider` on dashboard only) |
| `frontend/src/state/portfolio.tsx` | Active brokerage portfolio id |

## API clients

All HTTP goes through [`frontend/src/api/client.ts`](../frontend/src/api/client.ts).

| File | Backend prefix |
|------|----------------|
| `authApi.ts` | `/api/auth/*` |
| `transactionsApi.ts` | `/api/transactions` |
| `portfoliosApi.ts` | `/api/portfolios` |
| `portfolioApi.ts` | `/api/portfolio`, `/api/market-data/refresh` |
| `accountsApi.ts` | `/api/accounts` |
| `categoriesApi.ts` | `/api/categories` |
| `bondsApi.ts` | Bond holdings |
| `importApi.ts` | CSV import |
| `budgetsApi.ts` | `/api/budgets`, `/api/stats/budget-progress` |
| `statsApi.ts` | `/api/stats/*` |

## UI conventions

- Format money/dates: `frontend/src/utils/format.ts`.
- Reuse layout classes from `App.css` / `index.css`.
- Product copy in UI is often Polish; project **documentation** is English.

## Related docs

- [api.md](api.md) — REST catalog
- [architecture.md](architecture.md) — auth and data flow
