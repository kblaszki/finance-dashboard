import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionDateFilter } from "./routes/routeSupport";
import { badRequest } from "./routes/httpSupport";

type DbClient = PrismaClient | Prisma.TransactionClient;

type TransactionRow = {
  amount: unknown;
  currency: string;
  transactionType: string;
  category: string;
  categoryId?: number | null;
  date?: Date;
  splits?: Array<{
    amount: unknown;
    currency?: string;
    categoryId?: number;
    category?: { name: string };
  }>;
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

export function last12CompleteCalendarMonths(now = new Date()): {
  from: Date;
  to: Date;
  months: string[];
} {
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1, 0, 0, 0, 0);
  return { from: start, to: end, months: enumerateCalendarMonths(start, end) };
}

export function computeRollingMonthlyAverages(points: CashflowHistoryPoint[]): {
  avgIncome: number;
  avgExpense: number;
  avgNet: number;
} {
  if (points.length === 0) {
    return { avgIncome: 0, avgExpense: 0, avgNet: 0 };
  }
  const totals = points.reduce(
    (acc, point) => ({
      income: acc.income + point.income,
      expense: acc.expense + point.expense,
      net: acc.net + point.net,
    }),
    { income: 0, expense: 0, net: 0 },
  );
  const count = points.length;
  return {
    avgIncome: totals.income / count,
    avgExpense: totals.expense / count,
    avgNet: totals.net / count,
  };
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
    if (t.splits?.length) {
      for (const split of t.splits) {
        const amount = convertAmount(
          toNumber(split.amount),
          split.currency ?? t.currency,
          displayCurrency,
          plnPerUnit,
        );
        const label = split.category?.name ?? "Uncategorized";
        map.set(label, (map.get(label) ?? 0) + amount);
      }
      continue;
    }
    const amount = convertAmount(toNumber(t.amount), t.currency, displayCurrency, plnPerUnit);
    map.set(t.category, (map.get(t.category) ?? 0) + amount);
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function computeSpendByCategoryId(
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
): Map<number, number> {
  const map = new Map<number, number>();
  for (const t of rows) {
    if (t.splits?.length) {
      for (const split of t.splits) {
        if (split.categoryId == null) continue;
        const amount = convertAmount(
          toNumber(split.amount),
          split.currency ?? t.currency,
          displayCurrency,
          plnPerUnit,
        );
        map.set(split.categoryId, (map.get(split.categoryId) ?? 0) + amount);
      }
      continue;
    }
    if (t.categoryId == null) continue;
    const amount = convertAmount(toNumber(t.amount), t.currency, displayCurrency, plnPerUnit);
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + amount);
  }
  return map;
}

export async function fetchUserTransactions(
  prisma: DbClient,
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
      categoryId: true,
      date: true,
      splits: {
        select: {
          amount: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      },
    },
  });
}
