import type { PrismaClient } from "@prisma/client";

export type CategoryNode = {
  id: number;
  parentId: number | null;
  name: string;
  kind: string;
  path: string;
};

export async function buildCategoryPath(
  prisma: PrismaClient,
  userId: number,
  categoryId: number,
): Promise<string> {
  const parts: string[] = [];
  let currentId: number | null = categoryId;
  const seen = new Set<number>();

  while (currentId != null) {
    if (seen.has(currentId)) break;
    seen.add(currentId);
    const row: { name: string; parentId: number | null } | null = await prisma.category.findFirst({
      where: { id: currentId, userId },
    });
    if (!row) break;
    parts.unshift(row.name);
    currentId = row.parentId;
  }

  return parts.join(" > ");
}

export async function listCategoriesWithPaths(
  prisma: PrismaClient,
  userId: number,
  kind?: string,
): Promise<CategoryNode[]> {
  const where: { userId: number; kind?: string } = { userId };
  if (kind) where.kind = kind;

  const rows = await prisma.category.findMany({
    where,
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  const byId = new Map(rows.map((r) => [r.id, r]));

  function pathFor(id: number): string {
    const parts: string[] = [];
    let currentId: number | null = id;
    const seen = new Set<number>();
    while (currentId != null) {
      if (seen.has(currentId)) break;
      seen.add(currentId);
      const row = byId.get(currentId);
      if (!row) break;
      parts.unshift(row.name);
      currentId = row.parentId;
    }
    return parts.join(" > ");
  }

  return rows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    name: r.name,
    kind: r.kind,
    path: pathFor(r.id),
  }));
}

export async function resolveExpenseCategoryPath(
  prisma: PrismaClient,
  userId: number,
  expense: { category: string; categoryId: number | null },
): Promise<string> {
  if (expense.categoryId) {
    const path = await buildCategoryPath(prisma, userId, expense.categoryId);
    if (path) return path;
  }
  return expense.category;
}

export function listRootCategories(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.filter((n) => n.parentId == null);
}

export function rollupCategoryAmounts(
  items: Array<{ categoryPath: string; amount: number }>,
): Array<{ category: string; amount: number }> {
  const byRoot = new Map<string, number>();
  for (const item of items) {
    const root = item.categoryPath.split(" > ")[0]?.trim() || item.categoryPath;
    byRoot.set(root, (byRoot.get(root) ?? 0) + item.amount);
  }
  return [...byRoot.entries()].map(([category, amount]) => ({ category, amount }));
}
