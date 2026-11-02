import type { PrismaClient, Prisma } from "@prisma/client";
import { CASH_TX_TYPES } from "./cashLedger";
import { minorToMajor } from "./money";
import { badRequest } from "../lib/errors";

type Db = PrismaClient | Prisma.TransactionClient;

export type RecentCashActivityItem = {
  id: number;
  accountId: number;
  accountName: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  currency: string;
  occurredAt: string;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
};

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 50;

export function parseRecentActivityLimit(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    throw badRequest(`limit must be an integer from 1 to ${MAX_LIMIT}`);
  }
  return n;
}

/** Newest cash income/expense rows across owned accounts (excludes transfers). */
export async function listRecentCashActivity(
  db: Db,
  userId: number,
  limit: number,
): Promise<{ items: RecentCashActivityItem[]; uncategorizedCount: number }> {
  const [rows, uncategorizedCount] = await Promise.all([
    db.cashTransaction.findMany({
      where: {
        type: { in: [...CASH_TX_TYPES] },
        account: { userId },
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit,
      include: {
        account: { select: { id: true, name: true, currency: true } },
        category: { select: { id: true, name: true } },
      },
    }),
    db.cashTransaction.count({
      where: {
        type: { in: [...CASH_TX_TYPES] },
        categoryId: null,
        account: { userId },
      },
    }),
  ]);

  const items: RecentCashActivityItem[] = rows.map((row) => ({
    id: row.id,
    accountId: row.account.id,
    accountName: row.account.name,
    type: row.type as "INCOME" | "EXPENSE",
    amount: minorToMajor(row.amount),
    currency: row.account.currency,
    occurredAt: row.occurredAt.toISOString(),
    description: row.description,
    categoryId: row.category?.id ?? null,
    categoryName: row.category?.name ?? null,
  }));

  return { items, uncategorizedCount };
}
