import { Prisma } from "@prisma/client";
import { LEDGER_TX_TYPES, signedMinor, type LedgerTxType } from "./cashLedger";
import { listMonthsEndingAt, parseMonthsParam } from "./cashflowStats";
import {
  assertFxCurrency,
  formatYmdUtc,
  type FxCurrency,
  type FxNbpCurrency,
} from "./fx";
import { minorToMajor } from "./money";
import {
  aggregateNetWorth,
  type GetMidRowFn,
  type NetWorthAccountRow,
  type NetWorthRateUsed,
  valuationDateForMonth,
} from "./netWorth";

export type NetWorthHistoryTxRow = {
  type: string;
  /** Integer minor units (cents). */
  amount: number;
  occurredAt: Date;
};

export type NetWorthHistoryAccount = {
  accountType: string;
  currency: string;
  openingBalanceMinor: number;
  /** openingCashAsOf ?? createdAt — balance is 0 before this instant. */
  openingEffectiveAt: Date;
  transactions: NetWorthHistoryTxRow[];
};

export type NetWorthHistoryPoint = {
  month: string;
  asOf: string;
  netWorth: number;
};

export type NetWorthHistoryResult = {
  currency: FxCurrency;
  monthCount: number;
  series: NetWorthHistoryPoint[];
  ratesUsed: NetWorthRateUsed[];
};

/**
 * Reconstruct account cash balance (major units) as of `asOfExclusive`
 * (transactions with occurredAt < asOfExclusive). Returns 0 before opening.
 */
export function balanceMajorAsOf(
  account: NetWorthHistoryAccount,
  asOfExclusive: Date,
): number {
  if (account.openingEffectiveAt >= asOfExclusive) {
    return 0;
  }
  let running = account.openingBalanceMinor;
  for (const row of account.transactions) {
    const type = String(row.type).trim().toUpperCase();
    if (!(LEDGER_TX_TYPES as readonly string[]).includes(type)) continue;
    if (row.occurredAt < account.openingEffectiveAt) continue;
    if (row.occurredAt >= asOfExclusive) continue;
    running += signedMinor(type as LedgerTxType, row.amount);
  }
  return minorToMajor(running);
}

/** Day after the valuation calendar day (exclusive upper bound). */
export function asOfExclusiveBound(valuationDate: Date): Date {
  return new Date(
    Date.UTC(
      valuationDate.getUTCFullYear(),
      valuationDate.getUTCMonth(),
      valuationDate.getUTCDate() + 1,
    ),
  );
}

export async function aggregateNetWorthHistory(input: {
  currency: string;
  months: string[];
  accounts: NetWorthHistoryAccount[];
  asOfToday?: Date;
  getMidRow: GetMidRowFn;
}): Promise<NetWorthHistoryResult> {
  const reporting = assertFxCurrency(input.currency);
  const asOfToday = input.asOfToday ?? new Date();
  const ratesUsed = new Map<FxNbpCurrency, NetWorthRateUsed>();
  const series: NetWorthHistoryPoint[] = [];

  const midCache = new Map<string, { mid: Prisma.Decimal; rateDate: Date }>();
  const getMidRowCached: GetMidRowFn = async (currency, asOf) => {
    const key = `${currency}:${formatYmdUtc(asOf)}`;
    const cached = midCache.get(key);
    if (cached) return cached;
    const row = await input.getMidRow(currency, asOf);
    midCache.set(key, row);
    ratesUsed.set(currency, {
      currency,
      rateDate: formatYmdUtc(row.rateDate),
      mid: row.mid.toNumber(),
    });
    return row;
  };

  for (const month of input.months) {
    const valuationDate = valuationDateForMonth(month, asOfToday);
    const exclusive = asOfExclusiveBound(valuationDate);
    const snapshot: NetWorthAccountRow[] = input.accounts.map((account) => ({
      accountType: account.accountType,
      currency: account.currency,
      cashBalance: balanceMajorAsOf(account, exclusive),
    }));

    const point = await aggregateNetWorth({
      currency: reporting,
      asOf: valuationDate,
      accounts: snapshot,
      getMid: async (currency, asOf) =>
        (await getMidRowCached(currency, asOf)).mid,
      getMidRow: getMidRowCached,
    });

    series.push({
      month,
      asOf: formatYmdUtc(valuationDate),
      netWorth: point.netWorth,
    });
  }

  return {
    currency: reporting,
    monthCount: series.length,
    series,
    ratesUsed: [...ratesUsed.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
  };
}

export { listMonthsEndingAt, parseMonthsParam };
