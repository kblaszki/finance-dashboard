import { Prisma } from "@prisma/client";
import { CASH_TX_TYPES, type CashTxType } from "./cashLedger";
import { majorToDecimal } from "./money";
import type { StatsPeriodKind } from "./statsPeriod";

export type TagBreakdownRow = {
  tagId: number;
  tagName: string;
  total: number;
  count: number;
};

export type TagBreakdownUntagged = {
  income: number;
  expense: number;
  incomeCount: number;
  expenseCount: number;
};

export type TagBreakdownResult = {
  month: string;
  period: StatsPeriodKind;
  label: string;
  currency: string;
  income: TagBreakdownRow[];
  expense: TagBreakdownRow[];
  untagged: TagBreakdownUntagged;
};

export type TagBreakdownSourceRow = {
  type: string;
  amount: Prisma.Decimal | number;
  account: { currency: string };
  cashTransactionTags: { tag: { id: number; name: string } }[];
};

function sortTagRows(rows: TagBreakdownRow[]): TagBreakdownRow[] {
  return rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.tagName.localeCompare(b.tagName);
  });
}

function addTag(
  map: Map<number, TagBreakdownRow>,
  tagId: number,
  tagName: string,
  amount: Prisma.Decimal,
): void {
  const existing = map.get(tagId);
  if (existing) {
    existing.total = new Prisma.Decimal(existing.total).add(amount).toNumber();
    existing.count += 1;
  } else {
    map.set(tagId, {
      tagId,
      tagName,
      total: amount.toNumber(),
      count: 1,
    });
  }
}

/**
 * Attribute the full cash amount to each attached tag (multi-tag double-counts).
 * Untagged txs go only into the untagged bucket.
 */
export function aggregateTagBreakdown(
  month: string,
  currency: string,
  rows: TagBreakdownSourceRow[],
  options: { period?: StatsPeriodKind; label?: string } = {},
): TagBreakdownResult {
  const incomeMap = new Map<number, TagBreakdownRow>();
  const expenseMap = new Map<number, TagBreakdownRow>();
  let untaggedIncome = new Prisma.Decimal(0);
  let untaggedExpense = new Prisma.Decimal(0);
  let untaggedIncomeCount = 0;
  let untaggedExpenseCount = 0;

  for (const row of rows) {
    if (row.account.currency !== currency) continue;
    const type = String(row.type).trim().toUpperCase() as CashTxType;
    if (!(CASH_TX_TYPES as readonly string[]).includes(type)) continue;
    const amount = majorToDecimal(row.amount);
    if (!amount) continue;

    const tags = row.cashTransactionTags;
    if (!tags.length) {
      if (type === "INCOME") {
        untaggedIncome = untaggedIncome.add(amount);
        untaggedIncomeCount += 1;
      } else {
        untaggedExpense = untaggedExpense.add(amount);
        untaggedExpenseCount += 1;
      }
      continue;
    }

    const map = type === "INCOME" ? incomeMap : expenseMap;
    for (const link of tags) {
      addTag(map, link.tag.id, link.tag.name, amount);
    }
  }

  return {
    month,
    period: options.period ?? "month",
    label: options.label ?? month,
    currency,
    income: sortTagRows([...incomeMap.values()]),
    expense: sortTagRows([...expenseMap.values()]),
    untagged: {
      income: untaggedIncome.toNumber(),
      expense: untaggedExpense.toNumber(),
      incomeCount: untaggedIncomeCount,
      expenseCount: untaggedExpenseCount,
    },
  };
}
