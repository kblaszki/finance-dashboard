import { Prisma } from "@prisma/client";
import { badRequest } from "../lib/errors";
import { CASH_TX_TYPES, type CashTxType } from "./cashLedger";
import { majorToDecimal } from "./money";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const UNCATEGORIZED = "Uncategorized";

export type CategoryBreakdownRow = {
  categoryId: number | null;
  categoryName: string;
  currency: string;
  total: number;
  count: number;
};

export type CategoryBreakdownResult = {
  month: string;
  income: CategoryBreakdownRow[];
  expense: CategoryBreakdownRow[];
};

export type BreakdownSourceRow = {
  type: string;
  amount: Prisma.Decimal | number;
  categoryId: number | null;
  account: { currency: string };
  category: { id: number; name: string } | null;
};

export function parseMonthParam(value: unknown): { month: string; start: Date; end: Date } {
  if (value === undefined || value === null || value === "") {
    throw badRequest("month required");
  }
  const month = String(value).trim();
  if (!MONTH_RE.test(month)) {
    throw badRequest("month must be YYYY-MM");
  }
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { month, start, end };
}

function rowKey(categoryId: number | null, currency: string): string {
  return `${categoryId ?? "null"}:${currency}`;
}

function sortRows(rows: CategoryBreakdownRow[]): CategoryBreakdownRow[] {
  return rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const byName = a.categoryName.localeCompare(b.categoryName);
    if (byName !== 0) return byName;
    return a.currency.localeCompare(b.currency);
  });
}

export function aggregateCategoryBreakdown(
  month: string,
  rows: BreakdownSourceRow[],
): CategoryBreakdownResult {
  const incomeMap = new Map<string, CategoryBreakdownRow>();
  const expenseMap = new Map<string, CategoryBreakdownRow>();

  for (const row of rows) {
    const type = String(row.type).trim().toUpperCase() as CashTxType;
    if (!(CASH_TX_TYPES as readonly string[]).includes(type)) continue;

    const categoryId = row.categoryId;
    const categoryName = row.category?.name ?? UNCATEGORIZED;
    const currency = row.account.currency;
    const amount = majorToDecimal(row.amount);
    if (!amount) continue;

    const map = type === "INCOME" ? incomeMap : expenseMap;
    const key = rowKey(categoryId, currency);
    const existing = map.get(key);
    if (existing) {
      existing.total = new Prisma.Decimal(existing.total).add(amount).toNumber();
      existing.count += 1;
    } else {
      map.set(key, {
        categoryId,
        categoryName,
        currency,
        total: amount.toNumber(),
        count: 1,
      });
    }
  }

  return {
    month,
    income: sortRows([...incomeMap.values()]),
    expense: sortRows([...expenseMap.values()]),
  };
}
