import type { Category, Prisma, PrismaClient } from "@prisma/client";
import { badRequest, conflict, notFound } from "../lib/errors";

type Db = PrismaClient | Prisma.TransactionClient;

const DEFAULT_TREE: Array<{ name: string; children: string[] }> = [
  { name: "Income", children: ["Salary", "Other income"] },
  { name: "Expense", children: ["Food", "Housing", "Transport", "Other"] },
];

export function parseCategoryName(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) throw badRequest("name required");
  if (text.length > 80) throw badRequest("name must be at most 80 characters");
  return text;
}

/** Parse optional parentId: undefined = omit, null = root, number = parent. */
export function parseOptionalParentId(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest("parentId must be a valid id");
  }
  return n;
}

export async function assertParentOwned(
  db: Db,
  userId: number,
  parentId: number | null | undefined,
): Promise<void> {
  if (parentId === undefined || parentId === null) return;
  const parent = await db.category.findFirst({
    where: { id: parentId, userId },
    select: { id: true },
  });
  if (!parent) throw notFound("Parent category not found");
}

export async function assertSiblingNameUnique(
  db: Db,
  userId: number,
  name: string,
  parentId: number | null,
  excludeId?: number,
): Promise<void> {
  const siblings = await db.category.findMany({
    where: {
      userId,
      parentId: parentId === null ? null : parentId,
      ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true },
  });
  const lower = name.toLowerCase();
  if (siblings.some((s) => s.name.toLowerCase() === lower)) {
    throw badRequest("A category with this name already exists under the same parent");
  }
}

export async function assertNoCycle(
  db: Db,
  userId: number,
  categoryId: number,
  newParentId: number | null,
): Promise<void> {
  if (newParentId === null) return;
  if (newParentId === categoryId) {
    throw badRequest("category cannot be its own parent");
  }
  let cursor: number | null = newParentId;
  const seen = new Set<number>([categoryId]);
  while (cursor !== null) {
    if (seen.has(cursor)) {
      throw badRequest("reparent would create a cycle");
    }
    seen.add(cursor);
    const row: { parentId: number | null } | null = await db.category.findFirst({
      where: { id: cursor, userId },
      select: { parentId: true },
    });
    if (!row) throw notFound("Parent category not found");
    cursor = row.parentId;
  }
}

export async function findOwnedCategory(
  db: Db,
  userId: number,
  id: number,
): Promise<Category> {
  const category = await db.category.findFirst({ where: { id, userId } });
  if (!category) throw notFound("Category not found");
  return category;
}

export async function assertCanDeleteCategory(db: Db, categoryId: number): Promise<void> {
  const childCount = await db.category.count({ where: { parentId: categoryId } });
  if (childCount > 0) {
    throw conflict("Cannot delete a category that has child categories");
  }
}

export async function seedDefaultCategories(db: Db, userId: number): Promise<void> {
  for (const root of DEFAULT_TREE) {
    const parent = await db.category.create({
      data: { userId, name: root.name, parentId: null },
    });
    for (const childName of root.children) {
      await db.category.create({
        data: { userId, name: childName, parentId: parent.id },
      });
    }
  }
}

export function categoryPayload(category: Category) {
  return {
    id: category.id,
    name: category.name,
    parentId: category.parentId,
    createdAt: category.createdAt.toISOString(),
  };
}
