# MVP feature checklist

Last review: 2026-08-01 — statuses aligned to **auth-only baseline** in the repository (JWT auth, settings, health, private-deploy CLIs, prod auth rate limits). Feature specs under `mvp/features/**` remain the backlog for re-implementation; do not treat `planned` rows as shipped code.

## Legend

| Status | Meaning |
|--------|---------|
| done | Shipped end-to-end |
| in_progress | Partial / active work |
| stub | Surface exists, intentionally incomplete |
| planned | Not meaningfully implemented |

## Counts

| done | stub | planned | in_progress | total |
|------|------|---------|-------------|-------|
| 5 | 0 | 57 | 0 | 62 |

## Master table

| ID | Title | Status | Spec | Primary surface |
|----|-------|--------|------|-----------------|
| MVP-001 | Login and register with JWT | done | [features/auth/login-register-jwt.md](features/auth/login-register-jwt.md) | /login, /register |
| MVP-002 | Profile, email, and password settings | done | [features/auth/profile-email-password.md](features/auth/profile-email-password.md) | /settings |
| MVP-003 | Self-service password reset | planned | [features/auth/password-reset-api.md](features/auth/password-reset-api.md) | /password-reset (stub today) |
| FR-001 | Value-weighted average holding return | planned | [features/dashboard-stats/average-holding-return.md](features/dashboard-stats/average-holding-return.md) | Dashboard AverageReturnKpi |
| FR-002 | Net worth with five asset buckets | planned | [features/dashboard-stats/net-worth-buckets.md](features/dashboard-stats/net-worth-buckets.md) | Dashboard NetWorthSection |
| FR-003 | Statistics period cashflow summary | planned | [features/dashboard-stats/statistics-period-summary.md](features/dashboard-stats/statistics-period-summary.md) | /statistics |
| FR-004 | Cashflow history chart | planned | [features/dashboard-stats/cashflow-history-chart.md](features/dashboard-stats/cashflow-history-chart.md) | /statistics |
| FR-005 | Rolling 12-month cashflow averages | planned | [features/dashboard-stats/rolling-12m-cashflow.md](features/dashboard-stats/rolling-12m-cashflow.md) | Dashboard RollingCashflowKpis |
| FR-008 | Cross-account portfolio with bucket filters | planned | [features/dashboard-stats/portfolio-bucket-filters.md](features/dashboard-stats/portfolio-bucket-filters.md) | /portfolio |
| FR-016 | Category spend breakdown | planned | [features/dashboard-stats/category-spend-breakdown.md](features/dashboard-stats/category-spend-breakdown.md) | /statistics |
| FR-037 | Budget threshold alerts on dashboard | planned | [features/dashboard-stats/budget-alerts-banner.md](features/dashboard-stats/budget-alerts-banner.md) | BudgetAlertsBanner |
| FR-038 | Dashboard PLN net-worth rollup | planned | [features/dashboard-stats/pln-net-worth-rollup.md](features/dashboard-stats/pln-net-worth-rollup.md) | NetWorthSection |
| FR-006 | Extended account types | planned | [features/accounts/extended-account-types.md](features/accounts/extended-account-types.md) | /accounts create |
| FR-012 | Accounts list with type filter | planned | [features/accounts/accounts-list-filter.md](features/accounts/accounts-list-filter.md) | /accounts |
| FR-032 | Precious metal grams on account | planned | [features/accounts/precious-metal-grams.md](features/accounts/precious-metal-grams.md) | PRECIOUS_METAL account detail |
| MVP-010 | Manual revalue and account detail | planned | [features/accounts/account-detail-revalue.md](features/accounts/account-detail-revalue.md) | /accounts/:id |
| FR-011 | Internal cash transfers with FX suggestion | planned | [features/cash-transfers/internal-cash-transfers.md](features/cash-transfers/internal-cash-transfers.md) | /transfers |
| FR-018 | Transaction categories and splits | planned | [features/cash-transfers/transaction-categories-splits.md](features/cash-transfers/transaction-categories-splits.md) | TransactionTable |
| MVP-011 | Cash ledger transaction types | planned | [features/cash-transfers/cash-ledger-types.md](features/cash-transfers/cash-ledger-types.md) | Bank/brokerage cash forms |
| FR-007 | Asset trades with commission and settlementDate | planned | [features/holdings-trades/asset-trades-commission.md](features/holdings-trades/asset-trades-commission.md) | /transactions, lots |
| FR-009 | Instrument price chart and manual valuations | planned | [features/holdings-trades/instrument-price-chart.md](features/holdings-trades/instrument-price-chart.md) | /assets/:id |
| FR-014 | Account-scoped holding detail | planned | [features/holdings-trades/holding-detail.md](features/holdings-trades/holding-detail.md) | /accounts/:id/assets/:instrumentId |
| MVP-012 | FIFO realized P&L on closed lots | planned | [features/holdings-trades/fifo-realized-pnl.md](features/holdings-trades/fifo-realized-pnl.md) | Holding/portfolio KPIs |
| FR-019 | Bank and broker CSV import | planned | [features/import/csv-import-bank-broker.md](features/import/csv-import-bank-broker.md) | /import |
| FR-047 | Import presets catalog | planned | [features/import/import-presets.md](features/import/import-presets.md) | /import/presets |
| MVP-020 | Import preset column mapping UI wired to import | planned | [features/import/preset-column-mapping-ui.md](features/import/preset-column-mapping-ui.md) | /import/presets + /import |
| FR-010 | Historical NBP FX rates | planned | [features/market-fx/nbp-fx-history.md](features/market-fx/nbp-fx-history.md) | Display currency / valuations |
| FR-031 | Crypto EOD sync on CRYPTO accounts | planned | [features/market-fx/crypto-eod-sync.md](features/market-fx/crypto-eod-sync.md) | MarketPricesStatus |
| MVP-021 | STOCK/ETF market data sync | planned | [features/market-fx/stock-etf-market-sync.md](features/market-fx/stock-etf-market-sync.md) | Market sync + CLI |
| FR-015 | Category tree CRUD | planned | [features/budgets-categories/category-tree.md](features/budgets-categories/category-tree.md) | /categories |
| FR-017 | Monthly budgets vs spend | planned | [features/budgets-categories/monthly-budgets.md](features/budgets-categories/monthly-budgets.md) | /budgets |
| FR-034 | Auto-categorization rules | planned | [features/budgets-categories/categorization-rules.md](features/budgets-categories/categorization-rules.md) | /categories |
| FR-024 | Income events CRUD | planned | [features/income-liabilities/income-events.md](features/income-liabilities/income-events.md) | /income-events |
| FR-029 | Liabilities and net-worth impact | planned | [features/income-liabilities/liabilities.md](features/income-liabilities/liabilities.md) | /liabilities |
| FR-033 | Coupon schedules and record-income | planned | [features/income-liabilities/coupon-schedules.md](features/income-liabilities/coupon-schedules.md) | /income-events |
| FR-030 | Property rental and maintenance cash flows | planned | [features/property/property-cash-flows.md](features/property/property-cash-flows.md) | REAL_ESTATE account |
| FR-044 | Property sales and rental tax method | planned | [features/property/property-sales.md](features/property/property-sales.md) | REAL_ESTATE account + tax |
| MVP-030 | Manual asset valuation timeline | planned | [features/property/asset-valuations.md](features/property/asset-valuations.md) | Revalue account types |
| FR-022 | PIT-38 FIFO tax report | planned | [features/tax/pit38-tax-report.md](features/tax/pit38-tax-report.md) | /tax/:year |
| FR-023 | Tax report sell-row and instrument detail | planned | [features/tax/tax-report-detail-rows.md](features/tax/tax-report-detail-rows.md) | Tax report tables |
| FR-025 | Derivatives notice on tax report | planned | [features/tax/derivatives-notice.md](features/tax/derivatives-notice.md) | Tax report section |
| FR-026 | Rental PIT-36 helper section | planned | [features/tax/rental-pit36-helper.md](features/tax/rental-pit36-helper.md) | Tax report |
| FR-027 | Belka on interest and coupons | planned | [features/tax/belka-interest.md](features/tax/belka-interest.md) | Tax report |
| FR-028 | PIT/ZG foreign income helper | planned | [features/tax/pit-zg-helper.md](features/tax/pit-zg-helper.md) | Tax report |
| FR-039 | IKE/IKZE/PPK tax wrappers | planned | [features/tax/tax-wrappers.md](features/tax/tax-wrappers.md) | Account + tax settings |
| FR-040 | Corporate actions and stock splits | planned | [features/tax/corporate-actions.md](features/tax/corporate-actions.md) | Tax settings / holding split |
| FR-041 | Position transfers between brokerages | planned | [features/tax/position-transfers.md](features/tax/position-transfers.md) | Tax settings |
| FR-042 | Tax loss carryforward register | planned | [features/tax/loss-carryforward.md](features/tax/loss-carryforward.md) | Tax settings + report |
| FR-043 | Crypto PIT scale section and export | planned | [features/tax/crypto-pit-export.md](features/tax/crypto-pit-export.md) | Tax overview + export |
| FR-045 | Tax calendar and filing checklist | planned | [features/tax/tax-calendar.md](features/tax/tax-calendar.md) | /tax/calendar |
| FR-046 | Consolidated tax overview | planned | [features/tax/tax-overview.md](features/tax/tax-overview.md) | /tax/:year/overview |
| FR-048 | Tax snapshot correction warning | planned | [features/tax/tax-snapshot-warning.md](features/tax/tax-snapshot-warning.md) | Tax calendar/overview |
| FR-050 | Pre-sell tax impact simulator | planned | [features/tax/pre-sell-simulator.md](features/tax/pre-sell-simulator.md) | Holding detail |
| FR-035 | Account sync settings (stub) | planned | [features/automation-export/account-sync-stub.md](features/automation-export/account-sync-stub.md) | /settings |
| FR-036 | PSD2 bank connection (stub) | planned | [features/automation-export/psd2-bank-stub.md](features/automation-export/psd2-bank-stub.md) | /settings |
| MVP-040 | Real PSD2 bank transaction sync | planned | [features/automation-export/real-psd2-sync.md](features/automation-export/real-psd2-sync.md) | /settings |
| FR-049 | Document attachments metadata only | planned | [features/automation-export/document-attachments-metadata.md](features/automation-export/document-attachments-metadata.md) | /settings |
| NFR-002 | Full user JSON data export | planned | [features/automation-export/full-json-export.md](features/automation-export/full-json-export.md) | /settings |
| NFR-003 | Financial edit audit trail | planned | [features/automation-export/audit-trail.md](features/automation-export/audit-trail.md) | /settings |
| MVP-050 | Health check with DB ping | done | [features/ops/health-endpoint.md](features/ops/health-endpoint.md) | GET /api/health |
| MVP-051 | Private deploy: create-user and backup | done | [features/ops/private-deploy-tooling.md](features/ops/private-deploy-tooling.md) | CLI |
| MVP-052 | Production auth and import rate limits | done | [features/ops/prod-rate-limits.md](features/ops/prod-rate-limits.md) | app.ts (prod) |

## By domain

### auth

- **done** [MVP-001 Login and register with JWT](features/auth/login-register-jwt.md)
- **done** [MVP-002 Profile, email, and password settings](features/auth/profile-email-password.md)
- **planned** [MVP-003 Self-service password reset](features/auth/password-reset-api.md)

### accounts

- **planned** [FR-006 Extended account types](features/accounts/extended-account-types.md)
- **planned** [FR-012 Accounts list with type filter](features/accounts/accounts-list-filter.md)
- **planned** [FR-032 Precious metal grams on account](features/accounts/precious-metal-grams.md)
- **planned** [MVP-010 Manual revalue and account detail](features/accounts/account-detail-revalue.md)

### cash-transfers

- **planned** [FR-011 Internal cash transfers with FX suggestion](features/cash-transfers/internal-cash-transfers.md)
- **planned** [FR-018 Transaction categories and splits](features/cash-transfers/transaction-categories-splits.md)
- **planned** [MVP-011 Cash ledger transaction types](features/cash-transfers/cash-ledger-types.md)

### holdings-trades

- **planned** [FR-007 Asset trades with commission and settlementDate](features/holdings-trades/asset-trades-commission.md)
- **planned** [FR-009 Instrument price chart and manual valuations](features/holdings-trades/instrument-price-chart.md)
- **planned** [FR-014 Account-scoped holding detail](features/holdings-trades/holding-detail.md)
- **planned** [MVP-012 FIFO realized P&L on closed lots](features/holdings-trades/fifo-realized-pnl.md)

### import

- **planned** [FR-019 Bank and broker CSV import](features/import/csv-import-bank-broker.md)
- **planned** [FR-047 Import presets catalog](features/import/import-presets.md)
- **planned** [MVP-020 Import preset column mapping UI wired to import](features/import/preset-column-mapping-ui.md)

### market-fx

- **planned** [FR-010 Historical NBP FX rates](features/market-fx/nbp-fx-history.md)
- **planned** [FR-031 Crypto EOD sync on CRYPTO accounts](features/market-fx/crypto-eod-sync.md)
- **planned** [MVP-021 STOCK/ETF market data sync](features/market-fx/stock-etf-market-sync.md)

### dashboard-stats

- **planned** [FR-001 Value-weighted average holding return](features/dashboard-stats/average-holding-return.md)
- **planned** [FR-002 Net worth with five asset buckets](features/dashboard-stats/net-worth-buckets.md)
- **planned** [FR-003 Statistics period cashflow summary](features/dashboard-stats/statistics-period-summary.md)
- **planned** [FR-004 Cashflow history chart](features/dashboard-stats/cashflow-history-chart.md)
- **planned** [FR-005 Rolling 12-month cashflow averages](features/dashboard-stats/rolling-12m-cashflow.md)
- **planned** [FR-008 Cross-account portfolio with bucket filters](features/dashboard-stats/portfolio-bucket-filters.md)
- **planned** [FR-016 Category spend breakdown](features/dashboard-stats/category-spend-breakdown.md)
- **planned** [FR-037 Budget threshold alerts on dashboard](features/dashboard-stats/budget-alerts-banner.md)
- **planned** [FR-038 Dashboard PLN net-worth rollup](features/dashboard-stats/pln-net-worth-rollup.md)

### budgets-categories

- **planned** [FR-015 Category tree CRUD](features/budgets-categories/category-tree.md)
- **planned** [FR-017 Monthly budgets vs spend](features/budgets-categories/monthly-budgets.md)
- **planned** [FR-034 Auto-categorization rules](features/budgets-categories/categorization-rules.md)

### income-liabilities

- **planned** [FR-024 Income events CRUD](features/income-liabilities/income-events.md)
- **planned** [FR-029 Liabilities and net-worth impact](features/income-liabilities/liabilities.md)
- **planned** [FR-033 Coupon schedules and record-income](features/income-liabilities/coupon-schedules.md)

### property

- **planned** [FR-030 Property rental and maintenance cash flows](features/property/property-cash-flows.md)
- **planned** [FR-044 Property sales and rental tax method](features/property/property-sales.md)
- **planned** [MVP-030 Manual asset valuation timeline](features/property/asset-valuations.md)

### tax

- **planned** [FR-022 PIT-38 FIFO tax report](features/tax/pit38-tax-report.md)
- **planned** [FR-023 Tax report sell-row and instrument detail](features/tax/tax-report-detail-rows.md)
- **planned** [FR-025 Derivatives notice on tax report](features/tax/derivatives-notice.md)
- **planned** [FR-026 Rental PIT-36 helper section](features/tax/rental-pit36-helper.md)
- **planned** [FR-027 Belka on interest and coupons](features/tax/belka-interest.md)
- **planned** [FR-028 PIT/ZG foreign income helper](features/tax/pit-zg-helper.md)
- **planned** [FR-039 IKE/IKZE/PPK tax wrappers](features/tax/tax-wrappers.md)
- **planned** [FR-040 Corporate actions and stock splits](features/tax/corporate-actions.md)
- **planned** [FR-041 Position transfers between brokerages](features/tax/position-transfers.md)
- **planned** [FR-042 Tax loss carryforward register](features/tax/loss-carryforward.md)
- **planned** [FR-043 Crypto PIT scale section and export](features/tax/crypto-pit-export.md)
- **planned** [FR-045 Tax calendar and filing checklist](features/tax/tax-calendar.md)
- **planned** [FR-046 Consolidated tax overview](features/tax/tax-overview.md)
- **planned** [FR-048 Tax snapshot correction warning](features/tax/tax-snapshot-warning.md)
- **planned** [FR-050 Pre-sell tax impact simulator](features/tax/pre-sell-simulator.md)

### automation-export

- **planned** [FR-035 Account sync settings (stub)](features/automation-export/account-sync-stub.md)
- **planned** [FR-036 PSD2 bank connection (stub)](features/automation-export/psd2-bank-stub.md)
- **planned** [MVP-040 Real PSD2 bank transaction sync](features/automation-export/real-psd2-sync.md)
- **planned** [FR-049 Document attachments metadata only](features/automation-export/document-attachments-metadata.md)
- **planned** [NFR-002 Full user JSON data export](features/automation-export/full-json-export.md)
- **planned** [NFR-003 Financial edit audit trail](features/automation-export/audit-trail.md)

### ops

- **done** [MVP-050 Health check with DB ping](features/ops/health-endpoint.md)
- **done** [MVP-051 Private deploy: create-user and backup](features/ops/private-deploy-tooling.md)
- **done** [MVP-052 Production auth and import rate limits](features/ops/prod-rate-limits.md)
