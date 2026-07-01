import type { Prisma, PrismaClient } from "@prisma/client";
import { listUserBudgets, formatBudgetMonth } from "./budgets";
import { computeSpendByCategoryId, fetchUserTransactions } from "./stats";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_ALERT_THRESHOLDS = [80, 100] as const;

export type BudgetAlert = {
  categoryId: number;
  categoryName: string;
  budgetMonth: string;
  budgetAmount: number;
  spent: number;
  currency: string;
  pctUsed: number;
  threshold: number;
  severity: "warning" | "exceeded";
};

export async function computeBudgetAlerts(
  prisma: DbClient,
  userId: number,
  budgetMonth: Date,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
  convertAmount: (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    plnPerUnit: Record<string, number>,
  ) => number,
  toNumber: (value: unknown) => number,
  thresholds: number[] = [...DEFAULT_ALERT_THRESHOLDS],
): Promise<BudgetAlert[]> {
  const rows = await listUserBudgets(prisma, userId, budgetMonth);
  if (!rows.length) return [];

  const monthEnd = new Date(
    Date.UTC(budgetMonth.getUTCFullYear(), budgetMonth.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  const txRows = await fetchUserTransactions(
    prisma,
    userId,
    { gte: budgetMonth, lte: monthEnd },
    ["EXPENSE"],
  );
  const spentByCategory = computeSpendByCategoryId(
    txRows,
    displayCurrency,
    convertAmount,
    toNumber,
    plnPerUnit,
  );

  const categories = await prisma.category.findMany({ where: { userId } });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  const monthKey = formatBudgetMonth(budgetMonth);
  const alerts: BudgetAlert[] = [];
  const sortedThresholds = [...thresholds].sort((a, b) => a - b);

  for (const budget of rows) {
    const amount = Number(budget.amount);
    if (amount <= 0) continue;
    const spent = spentByCategory.get(budget.categoryId) ?? 0;
    const pctUsed = (spent / amount) * 100;
    const categoryName = nameById.get(budget.categoryId) ?? "Unknown";

    for (const threshold of sortedThresholds) {
      if (pctUsed >= threshold) {
        alerts.push({
          categoryId: budget.categoryId,
          categoryName,
          budgetMonth: monthKey,
          budgetAmount: amount,
          spent,
          currency: displayCurrency,
          pctUsed,
          threshold,
          severity: threshold >= 100 ? "exceeded" : "warning",
        });
        break;
      }
    }
  }

  return alerts.sort((a, b) => b.pctUsed - a.pctUsed);
}
