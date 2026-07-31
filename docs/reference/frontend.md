---
diataxis: reference
use_when: UI routes, API clients, and frontend layout
audience: both
related_docs:
  - docs/reference/api.md
related_code:
  - frontend/src/App.tsx
  - frontend/src/api/
---
# Frontend

Stack: Vite + React + TypeScript. Entry: `frontend/src/main.tsx`, routes in [`frontend/src/App.tsx`](../../frontend/src/App.tsx).

## Layout

| Layer | Path | Role |
|-------|------|------|
| Pages | `pages/` | Routable screens (most domains) |
| Feature folders | `features/tax/`, `features/import/` | Co-located pages + components for nav-isolated domains |
| Tax components | `features/tax/components/` | e.g. `TaxLossCarryforwardSection` shared by settings + report |
| Import components | `features/import/components/` | e.g. `BrokerImportForm` on account detail |
| Components | `components/` | Shared UI (charts under `components/Charts/`, account widgets, shell) |
| API | `api/` | `client.ts` + one module per backend area |
| State / hooks | `state/`, `hooks/` | Global context and `useAsyncData` |

Tax screens live under `features/tax/pages/`; import under `features/import/pages/`.

## Routes

| Path | Page | Key components |
|------|------|----------------|
| `/` | Landing (guests) | `pages/LandingPage.tsx` — marketing; authed users redirect to `/dashboard` |
| `/login` | Login | `pages/LoginPage.tsx` — email or username |
| `/register` | Register | `pages/RegisterPage.tsx` (username) |
| `/password-reset` | Password reset stub | `pages/PasswordResetPage.tsx` |
| `/dashboard` | Dashboard | `DashboardPage` — `PeriodFilter`, `MarketPricesStatus`, `NetWorthSection`, `BudgetAlertsBanner`, `RollingCashflowKpis`, `AverageReturnKpi`, `KpiCards`, `PortfolioKpiCards`, `BenchmarkComparison`, portfolio/budget charts (`CashFlowChart`, `AllocationChart`, `PortfolioHistoryChart`, category charts) |
| `/statistics` | Statistics | `StatisticsPage` — FR-003 (default: current month), FR-004 cashflow history chart, FR-016 `CategoryBreakdownSection` |
| `/categories` | Categories | `CategoriesPage` — FR-015 CRUD; FR-034 categorization rules |
| `/budgets` | Budgets | `BudgetsPage` — FR-017 monthly limits vs spend |
| `/import` | Import | `features/import/pages/ImportPage` — FR-019 bank (mBank/generic) and brokerage CSV |
| `/portfolio` | Portfolio (all accounts) | `PortfolioPage` — filters by account, type, bucket (FR-008) |
| `/assets/:id` | Asset price chart | `AssetDetailPage`, `InstrumentPriceChart` (FR-009) |
| `/accounts` | Accounts | `AccountsPage` → `ManagedAccountsList` — total balance, type filter (FR-012) |
| `/accounts/:id` | Account detail | `AccountDetailPage` — chart, `AccountStatsCards`, `AccountHoldingsTable` / `AccountActivityTable` / `TransactionTable`, `BrokerImportForm`, `ManualAccountRevalueForm`, `AssetValuationsSection`, `PropertyCashFlowsSection` / `PropertySalesSection` / `RentalTaxMethodForm` (REAL_ESTATE), `PreciousMetalGramsForm`, `TaxWrapperTypeForm`, `MarketPricesStatus`, `InstrumentPicker` |
| `/accounts/:id/assets/:instrumentId` | Holding detail (FR-014) | `HoldingDetailPage`, `HoldingKpiCards`, `HoldingValuationChart`, `HoldingLotsTable`; link to `/assets/:id` |
| `/accounts/:id/holdings/:holdingId` | Holding detail (legacy URL) | Same as `/accounts/:id/assets/:instrumentId` |
| `/transactions` | Asset trades | `TransactionsListPage` → `AssetTradesTable` (FR-007; `?accountId=` filter) |
| `/transfers` | Internal transfers | `TransfersPage` → `InternalTransfersTable` (FR-011; `?accountId=` filter) |
| `/tax` | PL tax report (current year default) | `features/tax/pages/TaxReportPage` — FR-022/023/025–028; loss carryforward section |
| `/tax/:year` | PL tax report for year | Same `TaxReportPage` with path year |
| `/tax/settings` | Tax prerequisites | `features/tax/pages/TaxSettingsPage` — FR-039–041; wrapper withdrawals, IKZE contributions, position transfers, corporate actions forms; `TaxLossCarryforwardSection` |
| `/tax/:year/overview` | Tax overview | `features/tax/pages/TaxOverviewPage` — FR-046 consolidated summary |
| `/tax/calendar` | Tax calendar | `features/tax/pages/TaxCalendarPage` — FR-045 deadlines + checklist |
| `/import/presets` | Import presets | `features/import/pages/ImportPresetsPage` — FR-047 broker templates |
| `/liabilities` | Liabilities | `LiabilitiesPage` — FR-029 mortgages, loans, credits |
| `/income-events` | Income events | `IncomeEventsPage` — FR-024 dividends, interest, coupons; FR-033 coupon schedule |
| `/settings` | Account settings | `SettingsPage` — profile/email/password (`authApi`); `DocumentAttachmentsSection`; `DataAutomationSection` (NFR-002 export, FR-035/036 sync stubs, NFR-003 audit) |

Sidebar (`AppShell`): Import presets, Tax settings, Tax calendar linked alongside primary nav.

Protected shell: `ProtectedRoute` → `AppShell`.

## State

| Module | Role |
|--------|------|
| `frontend/src/state/auth.tsx` | Session + `username` on register |
| `frontend/src/state/currency.tsx` | Display currency |
| `frontend/src/state/theme.tsx` | Light/dark theme |
| `frontend/src/state/period.tsx` | Dashboard and statistics date range (`PeriodProvider` on dashboard and `/statistics`) |
| `frontend/src/state/cashflow.tsx` | Dashboard cashflow stats (`CashFlowProvider`; uses `useAsyncData`) |
| `frontend/src/state/accountTypes.ts` | Account-type constants aligned with backend `accountTypes.ts` |

Preferred async pattern for page/widget data: [`frontend/src/hooks/useAsyncData.ts`](../../frontend/src/hooks/useAsyncData.ts).

## API clients

| File | Backend prefix |
|------|----------------|
| `authApi.ts` | `/api/auth/*` |
| `accountsApi.ts` | `/api/accounts`, `/:id/stats`, `/:id/valuations`, `POST .../revalue` |
| `transactionsApi.ts` | `/api/transactions` |
| `categoriesApi.ts` | `/api/categories` |
| `budgetsApi.ts` | `/api/budgets`, `/api/budgets/alerts` |
| `incomeEventsApi.ts` | `/api/income-events` |
| `liabilitiesApi.ts` | `/api/liabilities` |
| `propertyCashFlowsApi.ts` | `/api/property-cash-flows` |
| `assetValuationsApi.ts` | `/api/asset-valuations` |
| `couponSchedulesApi.ts` | `/api/coupon-schedules`, `POST .../:id/record-income` |
| `categorizationRulesApi.ts` | `/api/categorization-rules` |
| `accountSyncApi.ts` | `/api/account-sync`, `POST .../:accountId/run` |
| `bankConnectionsApi.ts` | `/api/bank-connections`, `POST .../:id/authorize` |
| `exportApi.ts` | `/api/export/full`, `/api/audit-logs` |
| `taxWrappersApi.ts` | `/api/tax-wrapper-withdrawals`, `/api/ikze-contributions` |
| `positionTransfersApi.ts` | `/api/position-transfers` |
| `corporateActionsApi.ts` | `/api/corporate-actions` |
| `taxOverviewApi.ts` | `/api/stats/tax-overview`, `/api/stats/pre-sell-simulator` |
| `taxLossCarryforwardApi.ts` | `/api/tax-loss-carryforward` |
| `propertySalesApi.ts` | `/api/property-sales` |
| `taxCalendarApi.ts` | `/api/tax-calendar`, `/api/tax-checklist` |
| `importPresetsApi.ts` | `/api/import/presets` |
| `documentAttachmentsApi.ts` | `/api/document-attachments` |
| `instrumentsApi.ts` | `/api/instruments`, `/api/instruments/:id/valuations` |
| `importApi.ts` | `POST /api/import/broker-trades`, `POST /api/import/bank-transactions` |
| `holdingsApi.ts` | `/api/accounts/:id/holdings`, `GET .../assets/:instrumentId`, `/api/holdings/:holdingId`, `POST .../split` |
| `portfolioApi.ts` | `GET /api/portfolio/positions` |
| `assetTradesApi.ts` | `GET/POST /api/asset-trades` |
| `internalTransfersApi.ts` | `GET/POST/DELETE /api/internal-transfers`, `GET .../fx-suggestion` |
| `holdingLotsApi.ts` | `/api/holdings/:holdingId/lots`, `DELETE /api/holding-lots/:id` |
| `valuationsApi.ts` | `/api/accounts/:id/holdings/:instrumentId/valuations` — fetched in `HoldingDetailPage` for `HoldingValuationChart` |
| `statsApi.ts` | `/api/stats/*` including `tax-report` |
| `taxReportApi.ts` | `GET /api/stats/tax-report/export` (CSV download) |
| `marketDataApi.ts` | `/api/market-data/*` |

## Related docs

- [api.md](api.md) — REST catalog
- [README.md](../../README.md) — setup and demo login

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
