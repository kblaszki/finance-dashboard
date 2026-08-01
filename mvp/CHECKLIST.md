# MVP feature checklist

Last review: 2026-08-01 (initial seed from requirements map + known stubs/planned gaps).

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
| 55 | 4 | 3 | 0 | 62 |

## Master table

| ID | Title | Status | Spec | Primary surface |
|----|-------|--------|------|-----------------|
| MVP-001 | Login and register with JWT | done | [features/auth/login-register-jwt.md](features/auth/login-register-jwt.md) | /login, /register |
| MVP-002 | Profile, email, and password settings | done | [features/auth/profile-email-password.md](features/auth/profile-email-password.md) | /settings |
| MVP-003 | Self-service password reset | planned | [features/auth/password-reset-api.md](features/auth/password-reset-api.md) | /password-reset (stub today) |
| FR-001 | Value-weighted average holding return | done | [features/dashboard-stats/average-holding-return.md](features/dashboard-stats/average-holding-return.md) | Dashboard AverageReturnKpi |
| FR-002 | Net worth with five asset buckets | done | [features/dashboard-stats/net-worth-buckets.md](features/dashboard-stats/net-worth-buckets.md) | Dashboard NetWorthSection |
| FR-003 | Statistics period cashflow summary | done | [features/dashboard-stats/statistics-period-summary.md](features/dashboard-stats/statistics-period-summary.md) | /statistics |
| FR-004 | Cashflow history chart | done | [features/dashboard-stats/cashflow-history-chart.md](features/dashboard-stats/cashflow-history-chart.md) | /statistics |
| FR-005 | Rolling 12-month cashflow averages | done | [features/dashboard-stats/rolling-12m-cashflow.md](features/dashboard-stats/rolling-12m-cashflow.md) | Dashboard RollingCashflowKpis |
| FR-008 | Cross-account portfolio with bucket filters | done | [features/dashboard-stats/portfolio-bucket-filters.md](features/dashboard-stats/portfolio-bucket-filters.md) | /portfolio |
| FR-016 | Category spend breakdown | done | [features/dashboard-stats/category-spend-breakdown.md](features/dashboard-stats/category-spend-breakdown.md) | /statistics |
| FR-037 | Budget threshold alerts on dashboard | done | [features/dashboard-stats/budget-alerts-banner.md](features/dashboard-stats/budget-alerts-banner.md) | BudgetAlertsBanner |
| FR-038 | Dashboard PLN net-worth rollup | done | [features/dashboard-stats/pln-net-worth-rollup.md](features/dashboard-stats/pln-net-worth-rollup.md) | NetWorthSection |
| FR-006 | Extended account types | done | [features/accounts/extended-account-types.md](features/accounts/extended-account-types.md) | /accounts create |
| FR-012 | Accounts list with type filter | done | [features/accounts/accounts-list-filter.md](features/accounts/accounts-list-filter.md) | /accounts |
| FR-032 | Precious metal grams on account | done | [features/accounts/precious-metal-grams.md](features/accounts/precious-metal-grams.md) | PRECIOUS_METAL account detail |
| MVP-010 | Manual revalue and account detail | done | [features/accounts/account-detail-revalue.md](features/accounts/account-detail-revalue.md) | /accounts/:id |
| FR-011 | Internal cash transfers with FX suggestion | done | [features/cash-transfers/internal-cash-transfers.md](features/cash-transfers/internal-cash-transfers.md) | /transfers |
| FR-018 | Transaction categories and splits | done | [features/cash-transfers/transaction-categories-splits.md](features/cash-transfers/transaction-categories-splits.md) | TransactionTable |
| MVP-011 | Cash ledger transaction types | done | [features/cash-transfers/cash-ledger-types.md](features/cash-transfers/cash-ledger-types.md) | Bank/brokerage cash forms |
| FR-007 | Asset trades with commission and settlementDate | done | [features/holdings-trades/asset-trades-commission.md](features/holdings-trades/asset-trades-commission.md) | /transactions, lots |
| FR-009 | Instrument price chart and manual valuations | done | [features/holdings-trades/instrument-price-chart.md](features/holdings-trades/instrument-price-chart.md) | /assets/:id |
| FR-014 | Account-scoped holding detail | done | [features/holdings-trades/holding-detail.md](features/holdings-trades/holding-detail.md) | /accounts/:id/assets/:instrumentId |
| MVP-012 | FIFO realized P&L on closed lots | done | [features/holdings-trades/fifo-realized-pnl.md](features/holdings-trades/fifo-realized-pnl.md) | Holding/portfolio KPIs |
| FR-019 | Bank and broker CSV import | done | [features/import/csv-import-bank-broker.md](features/import/csv-import-bank-broker.md) | /import |
| FR-047 | Import presets catalog | stub | [features/import/import-presets.md](features/import/import-presets.md) | /import/presets |
| MVP-020 | Import preset column mapping UI wired to import | planned | [features/import/preset-column-mapping-ui.md](features/import/preset-column-mapping-ui.md) | /import/presets + /import |
| FR-010 | Historical NBP FX rates | done | [features/market-fx/nbp-fx-history.md](features/market-fx/nbp-fx-history.md) | Display currency / valuations |
| FR-031 | Crypto EOD sync on CRYPTO accounts | done | [features/market-fx/crypto-eod-sync.md](features/market-fx/crypto-eod-sync.md) | MarketPricesStatus |
| MVP-021 | STOCK/ETF market data sync | done | [features/market-fx/stock-etf-market-sync.md](features/market-fx/stock-etf-market-sync.md) | Market sync + CLI |
| FR-015 | Category tree CRUD | done | [features/budgets-categories/category-tree.md](features/budgets-categories/category-tree.md) | /categories |
| FR-017 | Monthly budgets vs spend | done | [features/budgets-categories/monthly-budgets.md](features/budgets-categories/monthly-budgets.md) | /budgets |
| FR-034 | Auto-categorization rules | done | [features/budgets-categories/categorization-rules.md](features/budgets-categories/categorization-rules.md) | /categories |
| FR-024 | Income events CRUD | done | [features/income-liabilities/income-events.md](features/income-liabilities/income-events.md) | /income-events |
| FR-029 | Liabilities and net-worth impact | done | [features/income-liabilities/liabilities.md](features/income-liabilities/liabilities.md) | /liabilities |
| FR-033 | Coupon schedules and record-income | done | [features/income-liabilities/coupon-schedules.md](features/income-liabilities/coupon-schedules.md) | /income-events |
| FR-030 | Property rental and maintenance cash flows | done | [features/property/property-cash-flows.md](features/property/property-cash-flows.md) | REAL_ESTATE account |
| FR-044 | Property sales and rental tax method | done | [features/property/property-sales.md](features/property/property-sales.md) | REAL_ESTATE account + tax |
| MVP-030 | Manual asset valuation timeline | done | [features/property/asset-valuations.md](features/property/asset-valuations.md) | Revalue account types |
| FR-022 | PIT-38 FIFO tax report | done | [features/tax/pit38-tax-report.md](features/tax/pit38-tax-report.md) | /tax/:year |
| FR-023 | Tax report sell-row and instrument detail | done | [features/tax/tax-report-detail-rows.md](features/tax/tax-report-detail-rows.md) | Tax report tables |
| FR-025 | Derivatives notice on tax report | done | [features/tax/derivatives-notice.md](features/tax/derivatives-notice.md) | Tax report section |
| FR-026 | Rental PIT-36 helper section | done | [features/tax/rental-pit36-helper.md](features/tax/rental-pit36-helper.md) | Tax report |
| FR-027 | Belka on interest and coupons | done | [features/tax/belka-interest.md](features/tax/belka-interest.md) | Tax report |
| FR-028 | PIT/ZG foreign income helper | done | [features/tax/pit-zg-helper.md](features/tax/pit-zg-helper.md) | Tax report |
| FR-039 | IKE/IKZE/PPK tax wrappers | done | [features/tax/tax-wrappers.md](features/tax/tax-wrappers.md) | Account + tax settings |
| FR-040 | Corporate actions and stock splits | done | [features/tax/corporate-actions.md](features/tax/corporate-actions.md) | Tax settings / holding split |
| FR-041 | Position transfers between brokerages | done | [features/tax/position-transfers.md](features/tax/position-transfers.md) | Tax settings |
| FR-042 | Tax loss carryforward register | done | [features/tax/loss-carryforward.md](features/tax/loss-carryforward.md) | Tax settings + report |
| FR-043 | Crypto PIT scale section and export | done | [features/tax/crypto-pit-export.md](features/tax/crypto-pit-export.md) | Tax overview + export |
| FR-045 | Tax calendar and filing checklist | done | [features/tax/tax-calendar.md](features/tax/tax-calendar.md) | /tax/calendar |
| FR-046 | Consolidated tax overview | done | [features/tax/tax-overview.md](features/tax/tax-overview.md) | /tax/:year/overview |
| FR-048 | Tax snapshot correction warning | done | [features/tax/tax-snapshot-warning.md](features/tax/tax-snapshot-warning.md) | Tax calendar/overview |
| FR-050 | Pre-sell tax impact simulator | done | [features/tax/pre-sell-simulator.md](features/tax/pre-sell-simulator.md) | Holding detail |
| FR-035 | Account sync settings (stub) | stub | [features/automation-export/account-sync-stub.md](features/automation-export/account-sync-stub.md) | /settings |
| FR-036 | PSD2 bank connection (stub) | stub | [features/automation-export/psd2-bank-stub.md](features/automation-export/psd2-bank-stub.md) | /settings |
| MVP-040 | Real PSD2 bank transaction sync | planned | [features/automation-export/real-psd2-sync.md](features/automation-export/real-psd2-sync.md) | /settings |
| FR-049 | Document attachments metadata only | stub | [features/automation-export/document-attachments-metadata.md](features/automation-export/document-attachments-metadata.md) | /settings |
| NFR-002 | Full user JSON data export | done | [features/automation-export/full-json-export.md](features/automation-export/full-json-export.md) | /settings |
| NFR-003 | Financial edit audit trail | done | [features/automation-export/audit-trail.md](features/automation-export/audit-trail.md) | /settings |
| MVP-050 | Health check with DB ping | done | [features/ops/health-endpoint.md](features/ops/health-endpoint.md) | GET /api/health |
| MVP-051 | Private deploy: create-user and backup | done | [features/ops/private-deploy-tooling.md](features/ops/private-deploy-tooling.md) | CLI |
| MVP-052 | Production auth and import rate limits | done | [features/ops/prod-rate-limits.md](features/ops/prod-rate-limits.md) | app.ts (prod) |

## By domain

### auth

- **done** [MVP-001 Login and register with JWT](features/auth/login-register-jwt.md)
- **done** [MVP-002 Profile, email, and password settings](features/auth/profile-email-password.md)
- **planned** [MVP-003 Self-service password reset](features/auth/password-reset-api.md)

### accounts

- **done** [FR-006 Extended account types](features/accounts/extended-account-types.md)
- **done** [FR-012 Accounts list with type filter](features/accounts/accounts-list-filter.md)
- **done** [FR-032 Precious metal grams on account](features/accounts/precious-metal-grams.md)
- **done** [MVP-010 Manual revalue and account detail](features/accounts/account-detail-revalue.md)

### cash-transfers

- **done** [FR-011 Internal cash transfers with FX suggestion](features/cash-transfers/internal-cash-transfers.md)
- **done** [FR-018 Transaction categories and splits](features/cash-transfers/transaction-categories-splits.md)
- **done** [MVP-011 Cash ledger transaction types](features/cash-transfers/cash-ledger-types.md)

### holdings-trades

- **done** [FR-007 Asset trades with commission and settlementDate](features/holdings-trades/asset-trades-commission.md)
- **done** [FR-009 Instrument price chart and manual valuations](features/holdings-trades/instrument-price-chart.md)
- **done** [FR-014 Account-scoped holding detail](features/holdings-trades/holding-detail.md)
- **done** [MVP-012 FIFO realized P&L on closed lots](features/holdings-trades/fifo-realized-pnl.md)

### import

- **done** [FR-019 Bank and broker CSV import](features/import/csv-import-bank-broker.md)
- **stub** [FR-047 Import presets catalog](features/import/import-presets.md)
- **planned** [MVP-020 Import preset column mapping UI wired to import](features/import/preset-column-mapping-ui.md)

### market-fx

- **done** [FR-010 Historical NBP FX rates](features/market-fx/nbp-fx-history.md)
- **done** [FR-031 Crypto EOD sync on CRYPTO accounts](features/market-fx/crypto-eod-sync.md)
- **done** [MVP-021 STOCK/ETF market data sync](features/market-fx/stock-etf-market-sync.md)

### dashboard-stats

- **done** [FR-001 Value-weighted average holding return](features/dashboard-stats/average-holding-return.md)
- **done** [FR-002 Net worth with five asset buckets](features/dashboard-stats/net-worth-buckets.md)
- **done** [FR-003 Statistics period cashflow summary](features/dashboard-stats/statistics-period-summary.md)
- **done** [FR-004 Cashflow history chart](features/dashboard-stats/cashflow-history-chart.md)
- **done** [FR-005 Rolling 12-month cashflow averages](features/dashboard-stats/rolling-12m-cashflow.md)
- **done** [FR-008 Cross-account portfolio with bucket filters](features/dashboard-stats/portfolio-bucket-filters.md)
- **done** [FR-016 Category spend breakdown](features/dashboard-stats/category-spend-breakdown.md)
- **done** [FR-037 Budget threshold alerts on dashboard](features/dashboard-stats/budget-alerts-banner.md)
- **done** [FR-038 Dashboard PLN net-worth rollup](features/dashboard-stats/pln-net-worth-rollup.md)

### budgets-categories

- **done** [FR-015 Category tree CRUD](features/budgets-categories/category-tree.md)
- **done** [FR-017 Monthly budgets vs spend](features/budgets-categories/monthly-budgets.md)
- **done** [FR-034 Auto-categorization rules](features/budgets-categories/categorization-rules.md)

### income-liabilities

- **done** [FR-024 Income events CRUD](features/income-liabilities/income-events.md)
- **done** [FR-029 Liabilities and net-worth impact](features/income-liabilities/liabilities.md)
- **done** [FR-033 Coupon schedules and record-income](features/income-liabilities/coupon-schedules.md)

### property

- **done** [FR-030 Property rental and maintenance cash flows](features/property/property-cash-flows.md)
- **done** [FR-044 Property sales and rental tax method](features/property/property-sales.md)
- **done** [MVP-030 Manual asset valuation timeline](features/property/asset-valuations.md)

### tax

- **done** [FR-022 PIT-38 FIFO tax report](features/tax/pit38-tax-report.md)
- **done** [FR-023 Tax report sell-row and instrument detail](features/tax/tax-report-detail-rows.md)
- **done** [FR-025 Derivatives notice on tax report](features/tax/derivatives-notice.md)
- **done** [FR-026 Rental PIT-36 helper section](features/tax/rental-pit36-helper.md)
- **done** [FR-027 Belka on interest and coupons](features/tax/belka-interest.md)
- **done** [FR-028 PIT/ZG foreign income helper](features/tax/pit-zg-helper.md)
- **done** [FR-039 IKE/IKZE/PPK tax wrappers](features/tax/tax-wrappers.md)
- **done** [FR-040 Corporate actions and stock splits](features/tax/corporate-actions.md)
- **done** [FR-041 Position transfers between brokerages](features/tax/position-transfers.md)
- **done** [FR-042 Tax loss carryforward register](features/tax/loss-carryforward.md)
- **done** [FR-043 Crypto PIT scale section and export](features/tax/crypto-pit-export.md)
- **done** [FR-045 Tax calendar and filing checklist](features/tax/tax-calendar.md)
- **done** [FR-046 Consolidated tax overview](features/tax/tax-overview.md)
- **done** [FR-048 Tax snapshot correction warning](features/tax/tax-snapshot-warning.md)
- **done** [FR-050 Pre-sell tax impact simulator](features/tax/pre-sell-simulator.md)

### automation-export

- **stub** [FR-035 Account sync settings (stub)](features/automation-export/account-sync-stub.md)
- **stub** [FR-036 PSD2 bank connection (stub)](features/automation-export/psd2-bank-stub.md)
- **planned** [MVP-040 Real PSD2 bank transaction sync](features/automation-export/real-psd2-sync.md)
- **stub** [FR-049 Document attachments metadata only](features/automation-export/document-attachments-metadata.md)
- **done** [NFR-002 Full user JSON data export](features/automation-export/full-json-export.md)
- **done** [NFR-003 Financial edit audit trail](features/automation-export/audit-trail.md)

### ops

- **done** [MVP-050 Health check with DB ping](features/ops/health-endpoint.md)
- **done** [MVP-051 Private deploy: create-user and backup](features/ops/private-deploy-tooling.md)
- **done** [MVP-052 Production auth and import rate limits](features/ops/prod-rate-limits.md)


