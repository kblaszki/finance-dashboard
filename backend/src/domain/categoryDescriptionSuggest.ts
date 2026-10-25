import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest, notFound } from "../lib/errors";
import { normalizeImportDescription } from "./cashImportDedup";
import type { CashTxType } from "./cashLedger";
import type {
  CashLedgerImportDraft,
  CashLedgerImportResolved,
  ImportRowError,
} from "./cashLedgerCsvImport";
import type { CategoryLedgerType } from "./categories";
import { parseLedgerType } from "./categories";

type Db = PrismaClient | Prisma.TransactionClient;

export type UsedImportDescription = {
  /** Display label (first non-empty raw description seen). */
  description: string;
  descriptionKey: string;
  ledgerType: CashTxType;
  rowCount: number;
};

export type DescriptionSuggestion = {
  description: string;
  descriptionKey: string;
  ledgerType: CashTxType;
  rowCount: number;
  suggestedCategoryId: number | null;
  suggestionSource: "rule" | "history" | null;
};

export type DescriptionMapping =
  | {
      descriptionKey: string;
      ledgerType: CashTxType;
      action: "map";
      categoryId: number;
    }
  | {
      descriptionKey: string;
      ledgerType: CashTxType;
      action: "none";
    };

export type RuleRow = {
  id: number;
  pattern: string;
  patternKey: string;
  ledgerType: string;
  categoryId: number;
};

export type HistoryRow = {
  id: number;
  type: string;
  description: string | null;
  categoryId: number | null;
  occurredAt: Date;
  categoryLedgerType: string | null;
};

export type OwnedCategoryLite = {
  id: number;
  ledgerType: string;
};

function usedDescKey(descriptionKey: string, ledgerType: string): string {
  return `${ledgerType}\0${descriptionKey}`;
}

export function parseRulePattern(value: unknown): string {
  const text = normalizeImportDescription(String(value ?? ""));
  if (!text) throw badRequest("pattern required");
  if (text.length > 120) throw badRequest("pattern must be at most 120 characters");
  return text;
}

export function rulePatternKey(pattern: string): string {
  return normalizeImportDescription(pattern);
}

/** Drafts with no category path and a non-empty normalized description. */
export function collectUsedDescriptions(
  drafts: CashLedgerImportDraft[],
): UsedImportDescription[] {
  const map = new Map<string, UsedImportDescription>();
  for (const draft of drafts) {
    if (draft.categoryPath && draft.categoryPath.length > 0) continue;
    const descriptionKey = normalizeImportDescription(draft.description);
    if (!descriptionKey) continue;
    const key = usedDescKey(descriptionKey, draft.type);
    const existing = map.get(key);
    if (existing) {
      existing.rowCount += 1;
    } else {
      map.set(key, {
        description: (draft.description ?? "").trim() || descriptionKey,
        descriptionKey,
        ledgerType: draft.type,
        rowCount: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.ledgerType === b.ledgerType
      ? a.descriptionKey.localeCompare(b.descriptionKey)
      : a.ledgerType.localeCompare(b.ledgerType),
  );
}

export function suggestFromRules(
  used: UsedImportDescription[],
  rules: RuleRow[],
  owned: OwnedCategoryLite[],
): Map<string, number> {
  const ownedOk = new Set(
    owned
      .filter((c) => c.ledgerType === "INCOME" || c.ledgerType === "EXPENSE")
      .map((c) => `${c.ledgerType}\0${c.id}`),
  );
  const byType = new Map<string, RuleRow[]>();
  for (const rule of rules) {
    if (!ownedOk.has(`${rule.ledgerType}\0${rule.categoryId}`)) continue;
    const list = byType.get(rule.ledgerType) ?? [];
    list.push(rule);
    byType.set(rule.ledgerType, list);
  }
  for (const list of byType.values()) {
    list.sort((a, b) => {
      const len = b.patternKey.length - a.patternKey.length;
      if (len !== 0) return len;
      return a.id - b.id;
    });
  }

  const out = new Map<string, number>();
  for (const u of used) {
    const list = byType.get(u.ledgerType) ?? [];
    for (const rule of list) {
      if (u.descriptionKey.includes(rule.patternKey)) {
        out.set(usedDescKey(u.descriptionKey, u.ledgerType), rule.categoryId);
        break;
      }
    }
  }
  return out;
}

export function suggestFromHistory(
  used: UsedImportDescription[],
  history: HistoryRow[],
): Map<string, number> {
  const best = new Map<
    string,
    { categoryId: number; occurredAt: Date; id: number }
  >();
  for (const row of history) {
    if (row.categoryId == null) continue;
    if (row.categoryLedgerType !== row.type) continue;
    if (row.type !== "INCOME" && row.type !== "EXPENSE") continue;
    const keyDesc = normalizeImportDescription(row.description);
    if (!keyDesc) continue;
    const key = usedDescKey(keyDesc, row.type);
    const prev = best.get(key);
    if (
      !prev ||
      row.occurredAt > prev.occurredAt ||
      (row.occurredAt.getTime() === prev.occurredAt.getTime() &&
        row.id > prev.id)
    ) {
      best.set(key, {
        categoryId: row.categoryId,
        occurredAt: row.occurredAt,
        id: row.id,
      });
    }
  }

  const out = new Map<string, number>();
  for (const u of used) {
    const hit = best.get(usedDescKey(u.descriptionKey, u.ledgerType));
    if (hit) out.set(usedDescKey(u.descriptionKey, u.ledgerType), hit.categoryId);
  }
  return out;
}

export function mergeDescriptionSuggestions(
  used: UsedImportDescription[],
  fromRules: Map<string, number>,
  fromHistory: Map<string, number>,
): DescriptionSuggestion[] {
  return used.map((u) => {
    const key = usedDescKey(u.descriptionKey, u.ledgerType);
    const ruleId = fromRules.get(key);
    if (ruleId != null) {
      return {
        ...u,
        suggestedCategoryId: ruleId,
        suggestionSource: "rule" as const,
      };
    }
    const histId = fromHistory.get(key);
    if (histId != null) {
      return {
        ...u,
        suggestedCategoryId: histId,
        suggestionSource: "history" as const,
      };
    }
    return {
      ...u,
      suggestedCategoryId: null,
      suggestionSource: null,
    };
  });
}

export type ParseDescriptionMappingsResult =
  | { ok: true; mappings: DescriptionMapping[] }
  | { ok: false; errors: ImportRowError[] };

export function parseDescriptionMappings(
  body: unknown,
  used: UsedImportDescription[],
): ParseDescriptionMappingsResult {
  if (used.length === 0) {
    if (body === undefined || body === null) {
      return { ok: true, mappings: [] };
    }
    if (!Array.isArray(body)) {
      return {
        ok: false,
        errors: [{ row: 0, message: "descriptionMappings must be an array" }],
      };
    }
    if (body.length > 0) {
      return {
        ok: false,
        errors: [
          {
            row: 0,
            message:
              "descriptionMappings must be empty when no description suggestions apply",
          },
        ],
      };
    }
    return { ok: true, mappings: [] };
  }

  if (!Array.isArray(body)) {
    return {
      ok: false,
      errors: [{ row: 0, message: "descriptionMappings array required" }],
    };
  }

  const usedSet = new Set(
    used.map((u) => usedDescKey(u.descriptionKey, u.ledgerType)),
  );
  const seen = new Set<string>();
  const mappings: DescriptionMapping[] = [];
  const errors: ImportRowError[] = [];

  for (let i = 0; i < body.length; i++) {
    const raw = body[i];
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push({
        row: 0,
        message: `descriptionMappings[${i}] must be an object`,
      });
      continue;
    }
    const row = raw as Record<string, unknown>;
    const descriptionKey = normalizeImportDescription(
      String(row.descriptionKey ?? ""),
    );
    if (!descriptionKey) {
      errors.push({
        row: 0,
        message: `descriptionMappings[${i}].descriptionKey required`,
      });
      continue;
    }
    let ledgerType: CashTxType;
    try {
      const lt = parseLedgerType(row.ledgerType);
      if (lt !== "INCOME" && lt !== "EXPENSE") {
        throw badRequest("ledgerType must be INCOME or EXPENSE");
      }
      ledgerType = lt;
    } catch {
      errors.push({
        row: 0,
        message: `descriptionMappings[${i}].ledgerType must be INCOME or EXPENSE`,
      });
      continue;
    }
    const key = usedDescKey(descriptionKey, ledgerType);
    if (!usedSet.has(key)) {
      errors.push({
        row: 0,
        message: `descriptionMappings[${i}] does not match any description used in the CSV`,
      });
      continue;
    }
    if (seen.has(key)) {
      errors.push({
        row: 0,
        message: `descriptionMappings[${i}] duplicates another mapping`,
      });
      continue;
    }
    seen.add(key);
    const action = String(row.action ?? "");
    if (action === "none") {
      mappings.push({ descriptionKey, ledgerType, action: "none" });
      continue;
    }
    if (action === "map") {
      const categoryId = Number(row.categoryId);
      if (!Number.isInteger(categoryId) || categoryId < 1) {
        errors.push({
          row: 0,
          message: `descriptionMappings[${i}].categoryId must be a valid id`,
        });
        continue;
      }
      mappings.push({
        descriptionKey,
        ledgerType,
        action: "map",
        categoryId,
      });
      continue;
    }
    errors.push({
      row: 0,
      message: `descriptionMappings[${i}].action must be map or none`,
    });
  }

  for (const u of used) {
    const key = usedDescKey(u.descriptionKey, u.ledgerType);
    if (!seen.has(key)) {
      errors.push({
        row: 0,
        message: `missing descriptionMapping for ${u.ledgerType} "${u.description}"`,
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, mappings };
}

/**
 * Apply description mappings to drafts that still lack categoryId and path.
 * Path-resolved drafts (categoryId already set) are left unchanged.
 */
export function applyDescriptionMappings(
  resolved: CashLedgerImportResolved[],
  drafts: CashLedgerImportDraft[],
  mappings: DescriptionMapping[],
): CashLedgerImportResolved[] {
  const byKey = new Map<string, DescriptionMapping>();
  for (const m of mappings) {
    byKey.set(usedDescKey(m.descriptionKey, m.ledgerType), m);
  }

  return resolved.map((row, i) => {
    if (row.categoryId != null) return row;
    const draft = drafts[i];
    if (!draft) return row;
    if (draft.categoryPath && draft.categoryPath.length > 0) return row;
    const descriptionKey = normalizeImportDescription(draft.description);
    if (!descriptionKey) return row;
    const m = byKey.get(usedDescKey(descriptionKey, draft.type));
    if (!m || m.action === "none") return row;
    return { ...row, categoryId: m.categoryId };
  });
}

export async function loadUserDescriptionHistory(
  db: Db,
  userId: number,
): Promise<HistoryRow[]> {
  const accounts = await db.account.findMany({
    where: { userId },
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return [];

  const rows = await db.cashTransaction.findMany({
    where: {
      accountId: { in: accountIds },
      type: { in: ["INCOME", "EXPENSE"] },
      categoryId: { not: null },
      description: { not: null },
    },
    select: {
      id: true,
      type: true,
      description: true,
      categoryId: true,
      occurredAt: true,
      category: { select: { ledgerType: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    description: r.description,
    categoryId: r.categoryId,
    occurredAt: r.occurredAt,
    categoryLedgerType: r.category?.ledgerType ?? null,
  }));
}

export async function buildDescriptionSuggestions(
  db: Db,
  userId: number,
  drafts: CashLedgerImportDraft[],
  owned: OwnedCategoryLite[],
): Promise<DescriptionSuggestion[]> {
  const used = collectUsedDescriptions(drafts);
  if (used.length === 0) return [];

  const rules = await db.categoryDescriptionRule.findMany({
    where: { userId },
    select: {
      id: true,
      pattern: true,
      patternKey: true,
      ledgerType: true,
      categoryId: true,
    },
  });
  const history = await loadUserDescriptionHistory(db, userId);
  const fromRules = suggestFromRules(used, rules, owned);
  const fromHistory = suggestFromHistory(used, history);
  return mergeDescriptionSuggestions(used, fromRules, fromHistory);
}

export async function upsertExactDescriptionRule(
  db: Db,
  userId: number,
  descriptionKey: string,
  ledgerType: CashTxType,
  categoryId: number,
): Promise<void> {
  const pattern = descriptionKey;
  const patternKey = rulePatternKey(pattern);
  await db.categoryDescriptionRule.upsert({
    where: {
      userId_ledgerType_patternKey: {
        userId,
        ledgerType,
        patternKey,
      },
    },
    create: {
      userId,
      pattern,
      patternKey,
      ledgerType,
      categoryId,
    },
    update: { categoryId, pattern },
  });
}

export async function assertOwnedCategoryForDescription(
  db: Db,
  userId: number,
  categoryId: number,
  ledgerType: CategoryLedgerType,
): Promise<void> {
  if (ledgerType !== "INCOME" && ledgerType !== "EXPENSE") {
    throw badRequest("ledgerType must be INCOME or EXPENSE");
  }
  const cat = await db.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true, ledgerType: true },
  });
  if (!cat) throw notFound("Category not found");
  if (cat.ledgerType !== ledgerType) {
    throw badRequest("category ledgerType must match rule ledgerType");
  }
}

export function categoryDescriptionRulePayload(row: {
  id: number;
  pattern: string;
  ledgerType: string;
  categoryId: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    pattern: row.pattern,
    ledgerType: row.ledgerType,
    categoryId: row.categoryId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
