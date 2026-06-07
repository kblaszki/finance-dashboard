import type { PrismaClient } from "@prisma/client";
import { buildCategoryPath } from "./categories";

export const UNCATEGORIZED_NAME = "Niesklasyfikowane";

export async function ensureCategory(
  prisma: PrismaClient,
  userId: number,
  kind: "INCOME" | "EXPENSE",
  name: string,
  parentId: number | null,
): Promise<number> {
  const existing = await prisma.category.findFirst({
    where: { userId, kind, name, parentId },
  });
  if (existing) return existing.id;
  const created = await prisma.category.create({
    data: { userId, kind, name, parentId },
  });
  return created.id;
}

export async function ensureCategoryPath(
  prisma: PrismaClient,
  userId: number,
  kind: "INCOME" | "EXPENSE",
  path: string,
): Promise<number> {
  const parts = path
    .split(">")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) {
    return ensureCategory(prisma, userId, kind, UNCATEGORIZED_NAME, null);
  }
  let parentId: number | null = null;
  let lastId = 0;
  for (const part of parts) {
    lastId = await ensureCategory(prisma, userId, kind, part, parentId);
    parentId = lastId;
  }
  return lastId;
}

export async function migrateUserCategories(prisma: PrismaClient, userId: number): Promise<number> {
  await ensureCategory(prisma, userId, "EXPENSE", UNCATEGORIZED_NAME, null);
  await ensureCategory(prisma, userId, "INCOME", UNCATEGORIZED_NAME, null);

  const transactions = await prisma.transaction.findMany({ where: { userId } });
  let updated = 0;

  for (const tx of transactions) {
    if (tx.categoryId != null) continue;
    const kind: "INCOME" | "EXPENSE" = tx.type === "INCOME" ? "INCOME" : "EXPENSE";
    const raw = String(tx.category ?? "").trim() || UNCATEGORIZED_NAME;
    const categoryId = await ensureCategoryPath(prisma, userId, kind, raw);
    const path = await buildCategoryPath(prisma, userId, categoryId);
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { categoryId, category: path },
    });
    updated += 1;
  }

  return updated;
}

export async function migrateAllUsers(prisma: PrismaClient): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    const txCount = await migrateUserCategories(prisma, user.id);
    // eslint-disable-next-line no-console
    console.log(`User ${user.id}: ${txCount} transactions migrated`);
  }
}
