import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest } from "./routes/httpSupport";
import { getCategoryForUser } from "./categories";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type BudgetRow = {
  id: number;
  userId: number;
  categoryId: number;
  budgetMonth: Date;
  amount: unknown;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};

export function parseBudgetMonth(value: unknown): Date {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(raw)) {
    throw badRequest("budgetMonth must be YYYY-MM or YYYY-MM-DD");
  }
  const [y, m] = raw.split("-").map(Number);
  if (y == null || m == null || !Number.isFinite(y) || !Number.isFinite(m)) {
    throw badRequest("Invalid budgetMonth");
  }
  return new Date(Date.UTC(y, m - 1, 1));
}

export function formatBudgetMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function listUserBudgets(
  db: DbClient,
  userId: number,
  budgetMonth?: Date,
): Promise<BudgetRow[]> {
  return db.budget.findMany({
    where: {
      userId,
      ...(budgetMonth ? { budgetMonth } : {}),
    },
    orderBy: [{ budgetMonth: "desc" }, { categoryId: "asc" }],
  });
}

export async function upsertUserBudget(
  db: DbClient,
  userId: number,
  input: { categoryId: number; budgetMonth: Date; amount: number; currency: string },
): Promise<BudgetRow> {
  const category = await getCategoryForUser(db, userId, input.categoryId);
  if (!category) throw badRequest("Invalid categoryId");
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw badRequest("amount must be >= 0");
  }

  return db.budget.upsert({
    where: {
      userId_categoryId_budgetMonth: {
        userId,
        categoryId: input.categoryId,
        budgetMonth: input.budgetMonth,
      },
    },
    create: {
      userId,
      categoryId: input.categoryId,
      budgetMonth: input.budgetMonth,
      amount: input.amount,
      currency: input.currency,
    },
    update: {
      amount: input.amount,
      currency: input.currency,
    },
  });
}

export async function deleteUserBudget(
  db: DbClient,
  userId: number,
  budgetId: number,
): Promise<void> {
  const row = await db.budget.findFirst({ where: { id: budgetId, userId } });
  if (!row) throw badRequest("Budget not found");
  await db.budget.delete({ where: { id: budgetId } });
}

export function serializeBudget(
  row: BudgetRow,
  categoryName?: string,
  spent?: number,
) {
  const amount = Number(row.amount);
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: categoryName ?? null,
    budgetMonth: formatBudgetMonth(row.budgetMonth),
    amount,
    currency: row.currency,
    spent: spent ?? null,
    pctUsed: spent != null && amount > 0 ? (spent / amount) * 100 : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
