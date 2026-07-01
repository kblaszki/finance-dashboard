import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest } from "./routes/httpSupport";
import { getCategoryForUser } from "./categories";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const MATCH_TYPES = ["contains", "regex"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

const MATCH_SET = new Set<string>(MATCH_TYPES);

export type CategorizationRuleInput = {
  categoryId: number;
  pattern: string;
  matchType?: MatchType;
  priority?: number;
  active?: boolean;
};

export function parseMatchType(value: unknown): MatchType {
  const raw = String(value ?? "contains").trim().toLowerCase();
  if (!MATCH_SET.has(raw)) {
    throw badRequest(`Invalid matchType: ${raw}`);
  }
  return raw as MatchType;
}

export type RuleWithCategory = {
  pattern: string;
  matchType: string;
  priority: number;
  active: boolean;
  categoryId: number;
  category: { name: string };
};

export function matchCategorizationRule(
  description: string,
  rules: RuleWithCategory[],
): { categoryId: number; categoryName: string } | null {
  const sorted = [...rules]
    .filter((r) => r.active)
    .sort((a, b) => b.priority - a.priority);
  const text = description ?? "";

  for (const rule of sorted) {
    const pattern = rule.pattern.trim();
    if (!pattern) continue;

    if (rule.matchType === "regex") {
      try {
        if (new RegExp(pattern, "i").test(text)) {
          return { categoryId: rule.categoryId, categoryName: rule.category.name };
        }
      } catch {
        continue;
      }
    } else if (text.toLowerCase().includes(pattern.toLowerCase())) {
      return { categoryId: rule.categoryId, categoryName: rule.category.name };
    }
  }

  return null;
}

export async function listCategorizationRules(db: DbClient, userId: number) {
  return db.categorizationRule.findMany({
    where: { userId },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ priority: "desc" }, { id: "asc" }],
  });
}

export async function getCategorizationRuleForUser(db: DbClient, userId: number, id: number) {
  return db.categorizationRule.findFirst({
    where: { id, userId },
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function createCategorizationRule(
  db: DbClient,
  userId: number,
  input: CategorizationRuleInput,
) {
  const category = await getCategoryForUser(db, userId, input.categoryId);
  if (!category) throw badRequest("Invalid categoryId");
  const pattern = input.pattern.trim();
  if (!pattern) throw badRequest("pattern is required");

  return db.categorizationRule.create({
    data: {
      userId,
      categoryId: input.categoryId,
      pattern,
      matchType: input.matchType ?? "contains",
      priority: input.priority ?? 0,
      active: input.active ?? true,
    },
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function updateCategorizationRule(
  db: DbClient,
  userId: number,
  id: number,
  input: Partial<CategorizationRuleInput>,
) {
  const existing = await getCategorizationRuleForUser(db, userId, id);
  if (!existing) throw badRequest("Rule not found");
  if (input.categoryId != null) {
    const category = await getCategoryForUser(db, userId, input.categoryId);
    if (!category) throw badRequest("Invalid categoryId");
  }

  return db.categorizationRule.update({
    where: { id },
    data: {
      ...(input.categoryId != null ? { categoryId: input.categoryId } : {}),
      ...(input.pattern != null ? { pattern: input.pattern.trim() } : {}),
      ...(input.matchType != null ? { matchType: input.matchType } : {}),
      ...(input.priority != null ? { priority: input.priority } : {}),
      ...(input.active != null ? { active: input.active } : {}),
    },
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function deleteCategorizationRule(db: DbClient, userId: number, id: number): Promise<void> {
  const existing = await getCategorizationRuleForUser(db, userId, id);
  if (!existing) throw badRequest("Rule not found");
  await db.categorizationRule.delete({ where: { id } });
}

export async function loadActiveRulesForUser(db: DbClient, userId: number) {
  return db.categorizationRule.findMany({
    where: { userId, active: true },
    include: { category: { select: { name: true } } },
    orderBy: [{ priority: "desc" }, { id: "asc" }],
  });
}

export function serializeCategorizationRule(row: {
  id: number;
  categoryId: number;
  pattern: string;
  matchType: string;
  priority: number;
  active: boolean;
  createdAt: Date;
  category?: { id: number; name: string };
}) {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    pattern: row.pattern,
    matchType: row.matchType,
    priority: row.priority,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}
