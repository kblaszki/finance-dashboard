import { Prisma } from "@prisma/client";
import { badRequest } from "../lib/errors";
import { CASH_TX_TYPES, type CashTxType } from "./cashLedger";
import { parseMonthParam } from "./categoryBreakdown";
import { majorToDecimal, normalizeCurrencyCode } from "./money";

const ALLOWED_MONTHS = new Set([6, 12, 24]);

export type CashflowSourceRow = {
  type: string;
  amount: Prisma.Decimal | number;
  occurredAt: Date;
  account: { currency: string };
};

export type PeriodSummaryResult = {
  month: string;
  currency: string;
  income: number;
  expense: number;
  net: number;
};

export type CashflowHistoryPoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

export type CashflowHistoryResult = {
  currency: string;
  monthCount: number;
  series: CashflowHistoryPoint[];
};

export type RollingCashflow12mResult = {
  currency: string;
  monthCount: number;
  fromMonth: string;
  toMonth: string;
  avgIncome: number;
  avgExpense: number;
  avgNet: number;
};

export function parseCurrencyParam(value: unknown): string {
  return normalizeCurrencyCode(value);
}

export function parseMonthsParam(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return 12;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || !ALLOWED_MONTHS.has(n)) {
    throw badRequest("months must be 6, 12, or 24");
  }
  return n;
}

/** Oldest → newest YYYY-MM keys ending at endMonth (inclusive). */
export function listMonthsEndingAt(endMonth: string, n: number): string[] {
  const { start } = parseMonthParam(endMonth);
  const year = start.getUTCFullYear();
  const monthIndex = start.getUTCMonth();
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, monthIndex - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

/** Last `n` complete UTC months before the calendar month of `asOf` (excludes that month). */
export function completeMonthsBefore(asOf: Date, n = 12): string[] {
  const y = asOf.getUTCFullYear();
  const m = asOf.getUTCMonth();
  const previous = new Date(Date.UTC(y, m - 1, 1));
  const prevKey = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
  return listMonthsEndingAt(prevKey, n);
}

function monthKeyUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function emptyPoint(month: string): CashflowHistoryPoint {
  return { month, income: 0, expense: 0, net: 0 };
}

export function aggregatePeriodSummary(
  month: string,
  currency: string,
  rows: CashflowSourceRow[],
): PeriodSummaryResult {
  let income = new Prisma.Decimal(0);
  let expense = new Prisma.Decimal(0);

  for (const row of rows) {
    if (row.account.currency !== currency) continue;
    const type = String(row.type).trim().toUpperCase() as CashTxType;
    if (!(CASH_TX_TYPES as readonly string[]).includes(type)) continue;
    const amount = majorToDecimal(row.amount);
    if (!amount) continue;
    if (type === "INCOME") income = income.add(amount);
    else expense = expense.add(amount);
  }

  const incomeNumber = income.toNumber();
  const expenseNumber = expense.toNumber();
  return {
    month,
    currency,
    income: incomeNumber,
    expense: expenseNumber,
    net: income.sub(expense).toNumber(),
  };
}

export function aggregateCashflowHistory(
  months: string[],
  currency: string,
  rows: CashflowSourceRow[],
): CashflowHistoryResult {
  const byMonth = new Map<string, CashflowHistoryPoint>();
  for (const month of months) {
    byMonth.set(month, emptyPoint(month));
  }

  for (const row of rows) {
    if (row.account.currency !== currency) continue;
    const type = String(row.type).trim().toUpperCase() as CashTxType;
    if (!(CASH_TX_TYPES as readonly string[]).includes(type)) continue;
    const key = monthKeyUtc(row.occurredAt);
    const point = byMonth.get(key);
    if (!point) continue;
    const amount = majorToDecimal(row.amount);
    if (!amount) continue;
    if (type === "INCOME") point.income = new Prisma.Decimal(point.income).add(amount).toNumber();
    else point.expense = new Prisma.Decimal(point.expense).add(amount).toNumber();
    point.net = new Prisma.Decimal(point.income).sub(point.expense).toNumber();
  }

  return {
    currency,
    monthCount: months.length,
    series: months.map((m) => byMonth.get(m)!),
  };
}

export function aggregateRollingCashflow12m(
  currency: string,
  rows: CashflowSourceRow[],
  asOf: Date = new Date(),
): RollingCashflow12mResult {
  const months = completeMonthsBefore(asOf, 12);
  const history = aggregateCashflowHistory(months, currency, rows);
  const count = history.series.length;
  let incomeSum = new Prisma.Decimal(0);
  let expenseSum = new Prisma.Decimal(0);
  let netSum = new Prisma.Decimal(0);
  for (const point of history.series) {
    incomeSum = incomeSum.add(point.income);
    expenseSum = expenseSum.add(point.expense);
    netSum = netSum.add(point.net);
  }
  const divisor = new Prisma.Decimal(count);
  return {
    currency,
    monthCount: count,
    fromMonth: months[0]!,
    toMonth: months[count - 1]!,
    avgIncome: incomeSum.div(divisor).toNumber(),
    avgExpense: expenseSum.div(divisor).toNumber(),
    avgNet: netSum.div(divisor).toNumber(),
  };
}
