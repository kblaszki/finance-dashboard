import { CASH_TX_TYPES, signedMinor, type CashTxType } from "./cashLedger";
import { parseMonthParam } from "./categoryBreakdown";
import { listMonthsEndingAt, parseMonthsParam } from "./cashflowStats";
import { minorToMajor } from "./money";

export type BalanceHistorySourceRow = {
  type: string;
  /** Integer minor units (cents). */
  amount: number;
  occurredAt: Date;
};

export type AccountBalanceHistoryPoint = {
  month: string;
  balance: number;
};

export type AccountBalanceHistoryResult = {
  accountId: number;
  currency: string;
  monthCount: number;
  series: AccountBalanceHistoryPoint[];
};

/** Current UTC calendar month as YYYY-MM. */
export function currentUtcMonthKey(asOf: Date = new Date()): string {
  const y = asOf.getUTCFullYear();
  const m = String(asOf.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Parse month query; empty → current UTC month. */
export function resolveBalanceHistoryMonth(value: unknown): {
  month: string;
  start: Date;
  end: Date;
} {
  if (value === undefined || value === null || value === "") {
    return parseMonthParam(currentUtcMonthKey());
  }
  return parseMonthParam(value);
}

export { listMonthsEndingAt, parseMonthsParam };

/**
 * End-of-month cash balances: openingBalance + signed ledger deltas with
 * occurredAt before the start of the next month. Months with no activity stay flat.
 */
export function aggregateAccountBalanceHistory(
  accountId: number,
  currency: string,
  months: string[],
  openingBalanceMinor: number,
  rows: BalanceHistorySourceRow[],
): AccountBalanceHistoryResult {
  const sorted = rows
    .filter((row) => {
      const type = String(row.type).trim().toUpperCase();
      return (CASH_TX_TYPES as readonly string[]).includes(type);
    })
    .map((row) => ({
      type: String(row.type).trim().toUpperCase() as CashTxType,
      amount: row.amount,
      occurredAt: row.occurredAt,
    }))
    .sort((a, b) => {
      const t = a.occurredAt.getTime() - b.occurredAt.getTime();
      return t !== 0 ? t : 0;
    });

  let running = openingBalanceMinor;
  let txIndex = 0;
  const series: AccountBalanceHistoryPoint[] = [];

  for (const month of months) {
    const { end } = parseMonthParam(month);
    while (txIndex < sorted.length && sorted[txIndex]!.occurredAt < end) {
      const tx = sorted[txIndex]!;
      running += signedMinor(tx.type, tx.amount);
      txIndex += 1;
    }
    series.push({ month, balance: minorToMajor(running) });
  }

  return {
    accountId,
    currency,
    monthCount: months.length,
    series,
  };
}
