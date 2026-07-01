# Frontend

Stack: Vite + React + TypeScript. Entry: `frontend/src/main.tsx`, routes in [`frontend/src/App.tsx`](../frontend/src/App.tsx).

## Routes

| Path | Page | Key components |
|------|------|----------------|
| `/` | Landing (guests) | `pages/LandingPage.tsx` — marketing; authed users redirect to `/dashboard` |
| `/login` | Login | `pages/LoginPage.tsx` — email or username |
| `/register` | Register | `pages/RegisterPage.tsx` (username) |
| `/password-reset` | Password reset stub | `pages/PasswordResetPage.tsx` |
| `/dashboard` | Dashboard | `DashboardPage` — `NetWorthSection`, `RollingCashflowKpis`, `AverageReturnKpi` (FR-001/002/005), portfolio/budget tabs |
| `/statistics` | Statistics | `StatisticsPage` — FR-003 (default: current month), FR-004 cashflow history chart, FR-016 `CategoryBreakdownSection` |
| `/categories` | Categories | `CategoriesPage` — FR-015 CRUD; FR-034 categorization rules |
| `/budgets` | Budgets | `BudgetsPage` — FR-017 monthly limits vs spend |
| `/import` | Import | `ImportPage` — FR-019 bank (mBank/generic) and brokerage CSV |
| `/portfolio` | Portfolio (all accounts) | `PortfolioPage` — filters by account, type, bucket (FR-008) |
| `/assets/:id` | Asset price chart | `AssetDetailPage`, `InstrumentPriceChart` (FR-009) |
| `/accounts` | Accounts | `ManagedAccountsList` — total balance, type filter (FR-012) |
| `/accounts/:id` | Account detail | `AccountDetailPage`, chart date range, `AccountStatsCards`, `PropertyCashFlowsSection` (REAL_ESTATE), `PreciousMetalGramsForm` (PRECIOUS_METAL), … |
| `/accounts/:id/assets/:instrumentId` | Holding detail (FR-014) | `HoldingDetailPage`, `HoldingKpiCards`, `HoldingValuationChart`, `HoldingLotsTable`; link to `/assets/:id` |
| `/accounts/:id/holdings/:holdingId` | Holding detail (legacy URL) | Same as `/accounts/:id/assets/:instrumentId` |
| `/transactions` | Asset trades | `TransactionsListPage` → `AssetTradesTable` (FR-007; `?accountId=` filter) |
| `/transfers` | Internal transfers | `TransfersPage` → `InternalTransfersTable` (FR-011; `?accountId=` filter) |
| `/tax` | PL tax report | `TaxReportPage` — FR-022/023/025–028; `/tax/:year` |
| `/tax/settings` | Tax prerequisites | `TaxSettingsPage` — FR-039–041 wrappers, transfers, corporate actions |
| `/tax/:year/overview` | Tax overview | `TaxOverviewPage` — FR-046 consolidated summary |
| `/tax/calendar` | Tax calendar | `TaxCalendarPage` — FR-045 deadlines + checklist |
| `/import/presets` | Import presets | `ImportPresetsPage` — FR-047 broker templates |
| `/liabilities` | Liabilities | `LiabilitiesPage` — FR-029 mortgages, loans, credits |
| `/income-events` | Income events | `IncomeEventsPage` — FR-024 dividends, interest, coupons; FR-033 coupon schedule |
| `/settings` | Account settings | `SettingsPage` — profile; NFR-002 export, FR-035/036 sync stubs, NFR-003 audit |

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
| `categoriesApi.ts` | `/api/categories` |
| `budgetsApi.ts` | `/api/budgets` |
| `incomeEventsApi.ts` | `/api/income-events` |
| `liabilitiesApi.ts` | `/api/liabilities` |
| `propertyCashFlowsApi.ts` | `/api/property-cash-flows` |
| `assetValuationsApi.ts` | `/api/asset-valuations` |
| `couponSchedulesApi.ts` | `/api/coupon-schedules` |
| `categorizationRulesApi.ts` | `/api/categorization-rules` |
| `accountSyncApi.ts` | `/api/account-sync` |
| `bankConnectionsApi.ts` | `/api/bank-connections` |
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
| `holdingsApi.ts` | `/api/accounts/:id/holdings`, `/api/holdings/:holdingId`, `POST .../split` |
| `portfolioApi.ts` | `GET /api/portfolio/positions` |
| `assetTradesApi.ts` | `GET/POST /api/asset-trades` |
| `internalTransfersApi.ts` | `GET/POST/DELETE /api/internal-transfers` |
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
