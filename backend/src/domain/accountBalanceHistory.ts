import { LEDGER_TX_TYPES, signedMinor, type LedgerTxType } from "./cashLedger";
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

/** Effective opening instant: openingCashAsOf when set, otherwise createdAt. */
export function resolveOpeningEffectiveAt(account: {
  openingCashAsOf: Date | null;
  createdAt: Date;
}): Date {
  return account.openingCashAsOf ?? account.createdAt;
}

/**
 * End-of-month cash balances. Balance is 0 for months ending before
 * `openingEffectiveAt`. Opening balance is introduced on that date, then
 * ledger deltas with occurredAt >= openingEffectiveAt and < next month start
 * are applied (includes TRANSFER_IN / TRANSFER_OUT).
 */
export function aggregateAccountBalanceHistory(
  accountId: number,
  currency: string,
  months: string[],
  openingBalanceMinor: number,
  rows: BalanceHistorySourceRow[],
  openingEffectiveAt: Date,
): AccountBalanceHistoryResult {
  const sorted = rows
    .filter((row) => {
      const type = String(row.type).trim().toUpperCase();
      return (LEDGER_TX_TYPES as readonly string[]).includes(type);
    })
    .map((row) => ({
      type: String(row.type).trim().toUpperCase() as LedgerTxType,
      amount: row.amount,
      occurredAt: row.occurredAt,
    }))
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  let running = 0;
  let opened = false;
  let txIndex = 0;
  const series: AccountBalanceHistoryPoint[] = [];

  for (const month of months) {
    const { end } = parseMonthParam(month);
    if (!opened) {
      if (openingEffectiveAt >= end) {
        series.push({ month, balance: 0 });
        continue;
      }
      running = openingBalanceMinor;
      opened = true;
      while (txIndex < sorted.length && sorted[txIndex]!.occurredAt < end) {
        const tx = sorted[txIndex]!;
        if (tx.occurredAt >= openingEffectiveAt) {
          running += signedMinor(tx.type, tx.amount);
        }
        txIndex += 1;
      }
    } else {
      while (txIndex < sorted.length && sorted[txIndex]!.occurredAt < end) {
        const tx = sorted[txIndex]!;
        running += signedMinor(tx.type, tx.amount);
        txIndex += 1;
      }
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
