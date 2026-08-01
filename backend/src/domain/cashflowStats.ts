import type { Prisma } from "@prisma/client";
import { badRequest } from "../lib/errors";
import { CASH_TX_TYPES, type CashTxType } from "./cashLedger";
import { parseMonthParam } from "./categoryBreakdown";

const CURRENCY_RE = /^[A-Z]{3}$/;
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

export function parseCurrencyParam(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    throw badRequest("currency required");
  }
  const currency = String(value).trim().toUpperCase();
  if (!CURRENCY_RE.test(currency)) {
    throw badRequest("currency must be a 3-letter code");
  }
  return currency;
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

function decimalToNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
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
  let income = 0;
  let expense = 0;

  for (const row of rows) {
    if (row.account.currency !== currency) continue;
    const type = String(row.type).trim().toUpperCase() as CashTxType;
    if (!(CASH_TX_TYPES as readonly string[]).includes(type)) continue;
    const amount = decimalToNumber(row.amount);
    if (!Number.isFinite(amount)) continue;
    if (type === "INCOME") income += amount;
    else expense += amount;
  }

  return { month, currency, income, expense, net: income - expense };
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
    const amount = decimalToNumber(row.amount);
    if (!Number.isFinite(amount)) continue;
    if (type === "INCOME") point.income += amount;
    else point.expense += amount;
    point.net = point.income - point.expense;
  }

  return {
    currency,
    monthCount: months.length,
    series: months.map((m) => byMonth.get(m)!),
  };
}
