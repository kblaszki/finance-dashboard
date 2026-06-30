import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest } from "./routes/httpSupport";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type CategoryRow = {
  id: number;
  userId: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  createdAt: Date;
};

export type CategoryTreeNode = CategoryRow & { children: CategoryTreeNode[] };

export const DEFAULT_CATEGORY_NAMES = [
  "Salary",
  "Food",
  "Transport",
  "Shopping",
  "Utilities",
  "Entertainment",
  "Healthcare",
  "Other",
] as const;

export async function ensureDefaultCategories(db: DbClient, userId: number): Promise<number> {
  const count = await db.category.count({ where: { userId } });
  if (count > 0) return 0;

  let created = 0;
  for (let i = 0; i < DEFAULT_CATEGORY_NAMES.length; i++) {
    const name = DEFAULT_CATEGORY_NAMES[i]!;
    await db.category.create({
      data: { userId, name, sortOrder: (i + 1) * 10 },
    });
    created += 1;
  }
  return created;
}

export function buildCategoryTree(rows: CategoryRow[]): CategoryTreeNode[] {
  const byId = new Map<number, CategoryTreeNode>();
  for (const row of rows) {
    byId.set(row.id, { ...row, children: [] });
  }
  const roots: CategoryTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId != null) {
      const parent = byId.get(node.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const n of nodes) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}

export async function listUserCategories(db: DbClient, userId: number): Promise<CategoryRow[]> {
  return db.category.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

async function assertUniqueCategoryName(
  db: DbClient,
  userId: number,
  name: string,
  parentId: number | null,
  excludeId?: number,
): Promise<void> {
  const existing = await db.category.findFirst({
    where: {
      userId,
      name,
      parentId,
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw badRequest("Category name already exists at this level");
  }
}

async function assertParentCategory(
  db: DbClient,
  userId: number,
  parentId: number | null,
  categoryId?: number,
): Promise<void> {
  if (parentId == null) return;
  if (categoryId != null && parentId === categoryId) {
    throw badRequest("Category cannot be its own parent");
  }
  const parent = await db.category.findFirst({ where: { id: parentId, userId } });
  if (!parent) throw badRequest("Invalid parentId");
}

export async function createUserCategory(
  db: DbClient,
  userId: number,
  input: { name: string; parentId?: number | null; sortOrder?: number },
): Promise<CategoryRow> {
  const name = input.name.trim();
  if (!name) throw badRequest("name is required");
  const parentId = input.parentId ?? null;
  await assertParentCategory(db, userId, parentId);
  await assertUniqueCategoryName(db, userId, name, parentId);
  return db.category.create({
    data: {
      userId,
      name,
      parentId,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateUserCategory(
  db: DbClient,
  userId: number,
  categoryId: number,
  input: { name?: string; parentId?: number | null; sortOrder?: number },
): Promise<CategoryRow> {
  const existing = await db.category.findFirst({ where: { id: categoryId, userId } });
  if (!existing) throw badRequest("Category not found");

  const name = input.name != null ? input.name.trim() : existing.name;
  if (!name) throw badRequest("name is required");
  const parentId = input.parentId !== undefined ? input.parentId : existing.parentId;
  await assertParentCategory(db, userId, parentId, categoryId);
  await assertUniqueCategoryName(db, userId, name, parentId, categoryId);

  return db.category.update({
    where: { id: categoryId },
    data: {
      name,
      ...(input.parentId !== undefined ? { parentId } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

export async function deleteUserCategory(
  db: DbClient,
  userId: number,
  categoryId: number,
): Promise<void> {
  const existing = await db.category.findFirst({ where: { id: categoryId, userId } });
  if (!existing) throw badRequest("Category not found");

  const childCount = await db.category.count({ where: { parentId: categoryId, userId } });
  if (childCount > 0) throw badRequest("Remove child categories first");

  const inUse =
    (await db.transaction.count({ where: { categoryId } })) +
    (await db.transactionSplit.count({ where: { categoryId } })) +
    (await db.budget.count({ where: { categoryId } }));
  if (inUse > 0) throw badRequest("Category is in use");

  await db.category.delete({ where: { id: categoryId } });
}

export function serializeCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getCategoryForUser(
  db: DbClient,
  userId: number,
  categoryId: number,
): Promise<CategoryRow | null> {
  return db.category.findFirst({ where: { id: categoryId, userId } });
}
