/** Soft caps for unbounded historical loads (hobby-scale guardrails). */

/** Max rows returned for cash/transfer CSV export before 400. */
export const CSV_EXPORT_ROW_CAP = 50_000;

/** Max ledger rows scanned for account balance-history before 400. */
export const BALANCE_HISTORY_TX_CAP = 100_000;

/** Max transactions/transfers loaded for a statistics period before 400. */
export const STATS_PERIOD_ROW_CAP = 50_000;

/** Max rows for month-mode list endpoints before 400 (use cursor instead). */
export const MONTH_LIST_CAP = 2000;
