import type { PrismaClient } from "@prisma/client";
import type { TransactionDateFilter } from "./routes/routeSupport";
import { badRequest } from "./routes/httpSupport";

type TransactionRow = {
  amount: unknown;
  currency: string;
  transactionType: string;
  category: string;
};

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
    if (t.transactionType === "INCOME" || t.transactionType === "TRANSFER_IN") income += amount;
    if (t.transactionType === "EXPENSE" || t.transactionType === "TRANSFER_OUT") expense += amount;
  }
  return { income, expense, net: income - expense, currency: displayCurrency };
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
): Promise<TransactionRow[]> {
  return prisma.transaction.findMany({
    where: {
      account: { userId },
      ...(transactionTypes ? { transactionType: { in: transactionTypes } } : {}),
      date,
    },
  });
}
