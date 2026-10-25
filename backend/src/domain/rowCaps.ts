import { badRequest } from "../lib/errors";

/** Soft caps for unbounded historical loads (hobby-scale guardrails). */

/** Max rows returned for cash/transfer CSV export before 400. */
export const CSV_EXPORT_ROW_CAP = 50_000;

/** Max ledger rows scanned for account balance-history before 400. */
export const BALANCE_HISTORY_TX_CAP = 100_000;

/** Max transactions/transfers loaded for a statistics period before 400. */
export const STATS_PERIOD_ROW_CAP = 50_000;

/** Max rows for month-mode list endpoints before 400 (use cursor instead). */
export const MONTH_LIST_CAP = 2000;

/** Max cash ledger rows scanned for import fingerprint dedup. */
export const IMPORT_FINGERPRINT_SCAN_LIMIT = 50_000;

/** Max transfers scanned for transfer-import dedup. */
export const TRANSFER_IMPORT_DEDUP_SCAN_LIMIT = 50_000;

/** `kindHint` is the middle of the message, e.g. "the ledger" or "transfers". */
export function assertExportRowCap(count: number, kindHint: string): void {
  if (count > CSV_EXPORT_ROW_CAP) {
    throw badRequest(
      `Export exceeds ${CSV_EXPORT_ROW_CAP} rows; filter ${kindHint} or split exports`,
    );
  }
}

export function assertMonthListCap(count: number, kind: string): void {
  if (count > MONTH_LIST_CAP) {
    throw badRequest(
      `Month has more than ${MONTH_LIST_CAP} ${kind}; use cursor pagination (omit month)`,
    );
  }
}

export function assertStatsPeriodRowCap(count: number, label: string): void {
  if (count > STATS_PERIOD_ROW_CAP) {
    throw badRequest(
      `${label} has more than ${STATS_PERIOD_ROW_CAP} rows in this period; narrow the period`,
    );
  }
}

export function assertBalanceHistoryTxCap(count: number): void {
  if (count > BALANCE_HISTORY_TX_CAP) {
    throw badRequest(
      `Account has more than ${BALANCE_HISTORY_TX_CAP} transactions before this month; shorten history or archive older rows`,
    );
  }
}

export function assertImportFingerprintScanCap(count: number): void {
  if (count > IMPORT_FINGERPRINT_SCAN_LIMIT) {
    throw badRequest(
      `Too many ledger rows in the import date window (max ${IMPORT_FINGERPRINT_SCAN_LIMIT}); narrow the CSV date range`,
    );
  }
}

export function assertTransferImportDedupScanCap(count: number): void {
  if (count > TRANSFER_IMPORT_DEDUP_SCAN_LIMIT) {
    throw badRequest(
      `Too many transfers in the import date window (max ${TRANSFER_IMPORT_DEDUP_SCAN_LIMIT}); narrow the CSV date range`,
    );
  }
}
