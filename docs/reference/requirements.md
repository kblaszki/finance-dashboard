---
diataxis: reference
use_when: Trace FR/NFR/DATA requirement IDs to UI, API, and code
audience: agent
related_docs:
  - docs/reference/api.md
  - docs/reference/domain.md
  - docs/reference/frontend.md
  - docs/meta/code-map.md
---

# Requirements map

Hub: [docs/README.md](../README.md).

Traceability for requirement IDs found in code and docs. IDs are labels used in UI/API/tests — there is no separate requirements folder in the repo. Prefer this table over grepping four reference docs.

Primary docs: [api.md](api.md), [domain.md](domain.md), [frontend.md](frontend.md). How-tos linked where a task recipe exists.

## Functional requirements (FR)

| ID | Feature | Primary UI | Primary API / code | How-to / explanation |
|----|---------|------------|--------------------|----------------------|
| FR-001 | Value-weighted average holding return | Dashboard `AverageReturnKpi` | `GET /api/stats/average-holding-return`, `portfolioStats.ts` | [portfolio-stats](../explanation/portfolio-stats.md) |
| FR-002 | Net worth + 5-bucket breakdown | Dashboard `NetWorthSection` | `GET /api/stats/net-worth`, `netWorth.ts` | [portfolio-stats](../explanation/portfolio-stats.md), [liabilities](../how-to/liabilities.md) |
| FR-003 | Statistics period summary (default current month) | `/statistics` | `GET /api/stats/cashflow` (and related) | [dashboard-and-statistics](../how-to/dashboard-and-statistics.md) |
| FR-004 | Cashflow history chart | `/statistics` | `GET /api/stats/cashflow-history` | [dashboard-and-statistics](../how-to/dashboard-and-statistics.md) |
| FR-005 | Rolling 12-month cashflow averages | Dashboard `RollingCashflowKpis` | `GET /api/stats/cashflow-rolling-12m` | [dashboard-and-statistics](../how-to/dashboard-and-statistics.md) |
| FR-006 | Extended account types | `/accounts` create | `POST /api/accounts`, `accountTypes.ts` | [accounts-and-holdings](../how-to/accounts-and-holdings.md), [domain](domain.md) |
| FR-007 | Asset trades + commission + settlementDate | `/transactions`, holding lots | `/api/asset-trades`, lots routes | [accounts-and-holdings](../how-to/accounts-and-holdings.md) |
| FR-008 | Cross-account portfolio + bucket filters | `/portfolio` | `GET /api/portfolio/positions` | [dashboard-and-statistics](../how-to/dashboard-and-statistics.md), [accounts-and-holdings](../how-to/accounts-and-holdings.md) |
| FR-009 | Instrument price chart / metadata | `/assets/:id` | `/api/instruments/:id`, valuations | [market-data-sync](../how-to/market-data-sync.md) |
| FR-010 | Historical NBP FX (USD/EUR since 2020) | (display FX) | `FxRateDaily`, `fx.ts`, `fxHistorySync` | [architecture](../explanation/architecture.md) |
| FR-011 | Internal cash transfers | `/transfers` | `/api/internal-transfers` | [internal-transfers](../how-to/internal-transfers.md) |
| FR-012 | Accounts list + type filter | `/accounts` | `/api/accounts` | [accounts-and-holdings](../how-to/accounts-and-holdings.md) |
| FR-014 | Account-scoped holding detail | `/accounts/:id/assets/:instrumentId` | `GET .../assets/:instrumentId` | [accounts-and-holdings](../how-to/accounts-and-holdings.md) |
| FR-015 | Category tree CRUD | `/categories` | `/api/categories` | [budgets-and-categories](../how-to/budgets-and-categories.md) |
| FR-016 | Category spend breakdown | `/statistics` | stats category endpoints | [dashboard-and-statistics](../how-to/dashboard-and-statistics.md) |
| FR-017 | Monthly budgets vs spend | `/budgets` | `/api/budgets` | [budgets-and-categories](../how-to/budgets-and-categories.md) |
| FR-018 | Transaction categoryId + splits | Account `TransactionTable` | `POST /api/transactions` | [budgets-and-categories](../how-to/budgets-and-categories.md) |
| FR-019 | Bank / broker CSV import | `/import`, BrokerImportForm | `/api/import/*` | [import-csv](../how-to/import-csv.md) |
| FR-022 | PIT-38 FIFO tax report | `/tax/:year` | `GET /api/stats/tax-report` | [tax-year-workflow](../how-to/tax-year-workflow.md), [tax-pl](../explanation/tax-pl.md) |
| FR-023 | Tax report sell-row / instrument detail | Tax report tables | tax report payload | [tax-year-workflow](../how-to/tax-year-workflow.md) |
| FR-024 | Income events | `/income-events` | `/api/income-events` | [income-and-coupons](../how-to/income-and-coupons.md) |
| FR-025 | Derivatives notice on tax report | Tax report section | `taxReport.ts` flag | [tax-pl](../explanation/tax-pl.md) |
| FR-026 | Rental PIT-36 helper | Tax report | property cash flows + `rentalTaxMethod` | [property-tracking](../how-to/property-tracking.md), [tax-pl](../explanation/tax-pl.md) |
| FR-027 | Belka on interest/coupons | Tax report | income events / INTEREST | [tax-pl](../explanation/tax-pl.md) |
| FR-028 | PIT/ZG foreign income helper | Tax report | `sourceCountry` / `pitZgCountry` | [tax-pl](../explanation/tax-pl.md) |
| FR-029 | Liabilities (mortgage, loan, …) | `/liabilities` | `/api/liabilities`, net worth | [liabilities](../how-to/liabilities.md) |
| FR-030 | Property cash flows | REAL_ESTATE account detail | `/api/property-cash-flows` | [property-tracking](../how-to/property-tracking.md) |
| FR-031 | Crypto market EOD on CRYPTO accounts | Market sync banner | `marketDataSync` | [market-data-sync](../how-to/market-data-sync.md) |
| FR-032 | Precious metal grams | PRECIOUS_METAL account | `PUT /api/accounts/:id` `metalGrams` | [accounts-and-holdings](../how-to/accounts-and-holdings.md) |
| FR-033 | Coupon schedules | `/income-events` section | `/api/coupon-schedules` | [income-and-coupons](../how-to/income-and-coupons.md) |
| FR-034 | Categorization rules | `/categories` | `/api/categorization-rules` | [budgets-and-categories](../how-to/budgets-and-categories.md) |
| FR-035 | Account sync settings (stub) | `/settings` | `/api/account-sync` | [account-sync](../how-to/account-sync.md) |
| FR-036 | PSD2 bank connection (stub) | `/settings` | `/api/bank-connections` | [account-sync](../how-to/account-sync.md) |
| FR-037 | Budget threshold alerts | Dashboard banner | `GET /api/budgets/alerts` | [budgets-and-categories](../how-to/budgets-and-categories.md) |
| FR-038 | Dashboard PLN net-worth rollup | `NetWorthSection` | net-worth + FX as-of | [dashboard-and-statistics](../how-to/dashboard-and-statistics.md) |
| FR-039 | Tax wrappers IKE/IKZE/PPK | Account form + tax settings | wrappers APIs | [tax-year-workflow](../how-to/tax-year-workflow.md) |
| FR-040 | Corporate actions | Tax settings / split | `/api/corporate-actions` | [corporate-actions](../how-to/corporate-actions.md) |
| FR-041 | Position transfers | Tax settings | `/api/position-transfers` | [position-transfers](../how-to/position-transfers.md) |
| FR-042 | Tax loss carryforward | Tax settings + report | `/api/tax-loss-carryforward` | [tax-year-workflow](../how-to/tax-year-workflow.md) |
| FR-043 | Crypto PIT scale / export | Tax overview + export | `reportType=crypto_pit` | [tax-pl](../explanation/tax-pl.md) |
| FR-044 | Property sales (+ rental method UI label) | RE account + tax | `/api/property-sales` | [property-tracking](../how-to/property-tracking.md) |
| FR-045 | Tax calendar + checklist | `/tax/calendar` | `/api/tax-calendar`, checklist | [tax-year-workflow](../how-to/tax-year-workflow.md) |
| FR-046 | Tax overview consolidated | `/tax/:year/overview` | `GET /api/stats/tax-overview` | [tax-year-workflow](../how-to/tax-year-workflow.md) |
| FR-047 | Import presets | `/import/presets` | `/api/import/presets` | [import-csv](../how-to/import-csv.md) |
| FR-048 | Tax snapshot / correction warning | Tax calendar / overview | `taxReportCache.ts` | [tax-year-workflow](../how-to/tax-year-workflow.md) |
| FR-049 | Document attachments (metadata) | `/settings` | `/api/document-attachments` | [tax-year-workflow](../how-to/tax-year-workflow.md), [data-export](../how-to/data-export.md) |
| FR-050 | Pre-sell tax simulator | Holding detail | `POST /api/stats/pre-sell-simulator` | [tax-year-workflow](../how-to/tax-year-workflow.md), [fifo-cost-basis](../explanation/fifo-cost-basis.md) |

Missing numbers (e.g. FR-013, FR-020–021) are not referenced in the current codebase.

## Non-functional (NFR)

| ID | Feature | Primary UI | Primary API / code | Doc |
|----|---------|------------|--------------------|-----|
| NFR-002 | Full user JSON export | `/settings` | `GET /api/export/full` | [data-export](../how-to/data-export.md) |
| NFR-003 | Audit trail | `/settings` | `GET /api/audit-logs` | [data-export](../how-to/data-export.md) |

## Data model tags (DATA)

| ID | Feature | Model / field | Doc |
|----|---------|---------------|-----|
| DATA-002 | Opening cash as-of | `Account.openingCashAsOf` | [domain](domain.md) |
| DATA-007 / DATA-008 | Price/FX history epoch since 2020 | `marketDataEpoch.ts`, `FxRateDaily` | [architecture](../explanation/architecture.md), [market-data-sync](../how-to/market-data-sync.md) |
| DATA-010 | Account `totalBalance` on list | Latest valuation or cash | [api](api.md) Accounts |
| DATA-011 | Categories | `Category` | [domain](domain.md) |
| DATA-012 | Budgets | `Budget` | [domain](domain.md) |
| DATA-015 | Income events | `IncomeEvent` | [domain](domain.md) |
| DATA-016 | Liabilities | `Liability` | [domain](domain.md), [liabilities](../how-to/liabilities.md) |
| DATA-017 | Property cash flows | `PropertyCashFlow` | [domain](domain.md) |
| DATA-018 / DATA-023 | Tax wrappers | `taxWrapperType`, withdrawals, IKZE | [domain](domain.md) |
| DATA-019 | Corporate actions | `CorporateAction` | [domain](domain.md) |
| DATA-020 | Position transfers | `PositionTransfer` | [domain](domain.md) |
| DATA-021–022 | Tax completeness / attachments | snapshots, `DocumentAttachment` | [domain](domain.md) |
| DATA-024 | Asset valuations | `AssetValuation` | [domain](domain.md), [property-tracking](../how-to/property-tracking.md) |
| DATA-025 | Property sales | `PropertySale` | [domain](domain.md) |

## Related

- [code-map.md](../meta/code-map.md) — domain → code paths
- [AGENTS.md](../../AGENTS.md) — docs index
