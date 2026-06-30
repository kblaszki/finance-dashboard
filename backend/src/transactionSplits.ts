import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest } from "./routes/httpSupport";
import { getCategoryForUser } from "./categories";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type SplitInput = { categoryId: number; amount: number };

export async function validateTransactionSplits(
  db: DbClient,
  userId: number,
  parentAmount: number,
  splits: SplitInput[] | undefined,
): Promise<SplitInput[] | null> {
  if (!splits?.length) return null;

  let sum = 0;
  const seen = new Set<number>();
  for (const split of splits) {
    if (!Number.isFinite(split.amount) || split.amount <= 0) {
      throw badRequest("Each split amount must be positive");
    }
    if (seen.has(split.categoryId)) {
      throw badRequest("Duplicate category in splits");
    }
    seen.add(split.categoryId);
    const cat = await getCategoryForUser(db, userId, split.categoryId);
    if (!cat) throw badRequest("Invalid split categoryId");
    sum += split.amount;
  }

  if (Math.abs(sum - parentAmount) > 0.005) {
    throw badRequest("Split amounts must sum to transaction amount");
  }
  return splits;
}

export async function replaceTransactionSplits(
  db: DbClient,
  transactionId: number,
  splits: SplitInput[] | null,
): Promise<void> {
  await db.transactionSplit.deleteMany({ where: { transactionId } });
  if (!splits?.length) return;
  for (const split of splits) {
    await db.transactionSplit.create({
      data: {
        transactionId,
        categoryId: split.categoryId,
        amount: split.amount,
      },
    });
  }
}

export async function resolveTransactionCategory(
  db: DbClient,
  userId: number,
  opts: { categoryId?: number | null; category?: string; splits?: SplitInput[] | null },
): Promise<{ categoryId: number | null; category: string }> {
  if (opts.splits?.length) {
    return { categoryId: null, category: "SPLIT" };
  }
  if (opts.categoryId != null) {
    const cat = await getCategoryForUser(db, userId, opts.categoryId);
    if (!cat) throw badRequest("Invalid categoryId");
    return { categoryId: cat.id, category: cat.name };
  }
  const category = String(opts.category ?? "Uncategorized").trim() || "Uncategorized";
  return { categoryId: null, category };
}
