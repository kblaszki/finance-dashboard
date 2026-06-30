import type { PrismaClient } from "@prisma/client";
import type { TransactionDateFilter } from "./routes/routeSupport";
import { badRequest } from "./routes/httpSupport";

type TransactionRow = {
  amount: unknown;
  currency: string;
  transactionType: string;
  category: string;
  date?: Date;
};

export type CashflowHistoryPoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

const CASHFLOW_INCOME_TYPES = new Set(["INCOME", "DIVIDEND", "INTEREST"]);
const CASHFLOW_EXPENSE_TYPES = new Set(["EXPENSE"]);

export function isCashflowIncomeType(transactionType: string): boolean {
  return CASHFLOW_INCOME_TYPES.has(transactionType);
}

export function isCashflowExpenseType(transactionType: string): boolean {
  return CASHFLOW_EXPENSE_TYPES.has(transactionType);
}

export function requireTransactionDateFilter(
  transactionDateFilter: TransactionDateFilter,
  from?: unknown,
  to?: unknown,
): { gte?: Date; lte?: Date } {
  if (from == null || from === "" || to == null || to === "") {
    throw badRequest("from and to query parameters are required");
  }
  const date = transactionDateFilter(from, to);
  if (!date) {
    throw badRequest("from and to query parameters are required");
  }
  return date;
}

export function computeCashflowStats(
  rows: TransactionRow[],
  displayCurrency: string,
  convertAmount: (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    plnPerUnit: Record<string, number>,
  ) => number,
  toNumber: (value: unknown) => number,
  plnPerUnit: Record<string, number>,
): { income: number; expense: number; net: number; currency: string } {
  let income = 0;
  let expense = 0;
  for (const t of rows) {
    const amount = convertAmount(toNumber(t.amount), t.currency, displayCurrency, plnPerUnit);
    if (isCashflowIncomeType(t.transactionType)) {
      income += amount;
    }
    if (isCashflowExpenseType(t.transactionType)) {
      expense += amount;
    }
  }
  return { income, expense, net: income - expense, currency: displayCurrency };
}

function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function enumerateCalendarMonths(from: Date, to: Date): string[] {
  const months: string[] = [];
  let y = from.getFullYear();
  let m = from.getMonth();
  const endY = to.getFullYear();
  const endM = to.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}

export function computeCashflowHistory(
  rows: Array<TransactionRow & { date: Date }>,
  months: string[],
  displayCurrency: string,
  convertAmount: (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    plnPerUnit: Record<string, number>,
  ) => number,
  toNumber: (value: unknown) => number,
  plnPerUnit: Record<string, number>,
): CashflowHistoryPoint[] {
  const buckets = new Map<string, { income: number; expense: number }>();
  for (const month of months) {
    buckets.set(month, { income: 0, expense: 0 });
  }
  for (const t of rows) {
    const key = monthKeyFromDate(t.date);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const amount = convertAmount(toNumber(t.amount), t.currency, displayCurrency, plnPerUnit);
    if (isCashflowIncomeType(t.transactionType)) {
      bucket.income += amount;
    }
    if (isCashflowExpenseType(t.transactionType)) {
      bucket.expense += amount;
    }
  }
  return months.map((month) => {
    const bucket = buckets.get(month) ?? { income: 0, expense: 0 };
    return {
      month,
      income: bucket.income,
      expense: bucket.expense,
      net: bucket.income - bucket.expense,
    };
  });
}

export function computeCategoryBreakdown(
  rows: TransactionRow[],
  displayCurrency: string,
  convertAmount: (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    plnPerUnit: Record<string, number>,
  ) => number,
  toNumber: (value: unknown) => number,
  plnPerUnit: Record<string, number>,
): Array<{ category: string; amount: number }> {
  const map = new Map<string, number>();
  for (const t of rows) {
    const amount = convertAmount(toNumber(t.amount), t.currency, displayCurrency, plnPerUnit);
    map.set(t.category, (map.get(t.category) ?? 0) + amount);
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount }));
}

export async function fetchUserTransactions(
  prisma: PrismaClient,
  userId: number,
  date: { gte?: Date; lte?: Date },
  transactionTypes?: string[],
): Promise<Array<TransactionRow & { date: Date }>> {
  return prisma.transaction.findMany({
    where: {
      account: { userId },
      ...(transactionTypes ? { transactionType: { in: transactionTypes } } : {}),
      date,
    },
    select: {
      amount: true,
      currency: true,
      transactionType: true,
      category: true,
      date: true,
    },
  });
}
