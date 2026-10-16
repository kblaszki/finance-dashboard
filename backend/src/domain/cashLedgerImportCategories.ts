import type { Category, Prisma, PrismaClient } from "@prisma/client";
import {
  buildCategoryPathMap,
  categoryPathKey,
  formatCategoryPath,
  parseCategoryPath,
} from "./cashLedgerCsv";
import type {
  CashLedgerImportDraft,
  CashLedgerImportResolved,
  ImportRowError,
} from "./cashLedgerCsvImport";
import { categoryNameKey, type CategoryLedgerType } from "./categories";
import { badRequest } from "../lib/errors";

type Db = PrismaClient | Prisma.TransactionClient;

export type UsedImportCategory = {
  path: string;
  ledgerType: CategoryLedgerType;
  rowCount: number;
  segments: string[];
};

export type ImportCategoryPreview = {
  path: string;
  ledgerType: CategoryLedgerType;
  rowCount: number;
  suggestedCategoryId: number | null;
};

export type CategoryMappingAction = "map" | "create" | "none";

export type ImportCategoryMapping =
  | {
      path: string;
      ledgerType: CategoryLedgerType;
      action: "map";
      categoryId: number;
    }
  | {
      path: string;
      ledgerType: CategoryLedgerType;
      action: "create";
    }
  | {
      path: string;
      ledgerType: CategoryLedgerType;
      action: "none";
    };

export type OwnedCategoryRow = {
  id: number;
  name: string;
  parentId: number | null;
  ledgerType: string;
};

function usedKey(path: string, ledgerType: string): string {
  return `${ledgerType}\0${path}`;
}

/** Collect unique (path, ledgerType) pairs from drafts that have a category path. */
export function collectUsedCategories(
  drafts: CashLedgerImportDraft[],
): UsedImportCategory[] {
  const map = new Map<string, UsedImportCategory>();
  for (const draft of drafts) {
    if (!draft.categoryPath || draft.categoryPath.length === 0) continue;
    const path = formatCategoryPath(draft.categoryPath);
    const key = usedKey(path, draft.type);
    const existing = map.get(key);
    if (existing) {
      existing.rowCount += 1;
    } else {
      map.set(key, {
        path,
        ledgerType: draft.type,
        rowCount: 1,
        segments: draft.categoryPath,
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.ledgerType === b.ledgerType
      ? a.path.localeCompare(b.path)
      : a.ledgerType.localeCompare(b.ledgerType),
  );
}

/**
 * Suggest owned category ids for exact case-insensitive path + matching ledgerType.
 */
export function suggestCategoryMatches(
  used: UsedImportCategory[],
  owned: OwnedCategoryRow[],
): ImportCategoryPreview[] {
  const pathById = buildCategoryPathMap(owned);
  const byKey = new Map<string, number>();
  for (const cat of owned) {
    const path = pathById.get(cat.id);
    if (!path) continue;
    const parsed = parseCategoryPath(path);
    if (!parsed.ok) continue;
    const key = `${cat.ledgerType}\0${categoryPathKey(parsed.segments)}`;
    // First match wins if duplicates somehow share the same key
    if (!byKey.has(key)) byKey.set(key, cat.id);
  }

  return used.map((u) => {
    const key = `${u.ledgerType}\0${categoryPathKey(u.segments)}`;
    return {
      path: u.path,
      ledgerType: u.ledgerType,
      rowCount: u.rowCount,
      suggestedCategoryId: byKey.get(key) ?? null,
    };
  });
}

export type ParseMappingsResult =
  | { ok: true; mappings: ImportCategoryMapping[] }
  | { ok: false; errors: ImportRowError[] };

/**
 * Validate that categoryMappings cover every used category exactly once.
 */
export function parseCategoryMappings(
  body: unknown,
  used: UsedImportCategory[],
): ParseMappingsResult {
  if (used.length === 0) {
    if (body === undefined || body === null) {
      return { ok: true, mappings: [] };
    }
    if (!Array.isArray(body)) {
      return {
        ok: false,
        errors: [{ row: 0, message: "categoryMappings must be an array" }],
      };
    }
    if (body.length > 0) {
      return {
        ok: false,
        errors: [
          {
            row: 0,
            message: "categoryMappings must be empty when the CSV has no categories",
          },
        ],
      };
    }
    return { ok: true, mappings: [] };
  }

  if (!Array.isArray(body)) {
    return {
      ok: false,
      errors: [{ row: 0, message: "categoryMappings array required" }],
    };
  }

  const usedKeys = new Set(used.map((u) => usedKey(u.path, u.ledgerType)));
  const seen = new Set<string>();
  const mappings: ImportCategoryMapping[] = [];
  const errors: ImportRowError[] = [];

  for (let i = 0; i < body.length; i++) {
    const item = body[i];
    if (!item || typeof item !== "object") {
      errors.push({ row: 0, message: `categoryMappings[${i}] must be an object` });
      continue;
    }
    const raw = item as Record<string, unknown>;
    const path = String(raw.path ?? "").trim();
    const ledgerRaw = String(raw.ledgerType ?? "").trim().toUpperCase();
    const action = String(raw.action ?? "").trim().toLowerCase();

    if (!path) {
      errors.push({ row: 0, message: `categoryMappings[${i}].path required` });
      continue;
    }
    if (ledgerRaw !== "INCOME" && ledgerRaw !== "EXPENSE") {
      errors.push({
        row: 0,
        message: `categoryMappings[${i}].ledgerType must be INCOME or EXPENSE`,
      });
      continue;
    }
    const ledgerType = ledgerRaw as CategoryLedgerType;
    const key = usedKey(path, ledgerType);
    if (!usedKeys.has(key)) {
      errors.push({
        row: 0,
        message: `categoryMappings[${i}] does not match any category used in the CSV`,
      });
      continue;
    }
    if (seen.has(key)) {
      errors.push({
        row: 0,
        message: `duplicate mapping for ${ledgerType} "${path}"`,
      });
      continue;
    }
    seen.add(key);

    if (action === "none") {
      mappings.push({ path, ledgerType, action: "none" });
      continue;
    }
    if (action === "create") {
      mappings.push({ path, ledgerType, action: "create" });
      continue;
    }
    if (action === "map") {
      const n = Number(raw.categoryId);
      if (!Number.isInteger(n) || n < 1) {
        errors.push({
          row: 0,
          message: `categoryMappings[${i}].categoryId must be a valid id`,
        });
        continue;
      }
      mappings.push({ path, ledgerType, action: "map", categoryId: n });
      continue;
    }
    errors.push({
      row: 0,
      message: `categoryMappings[${i}].action must be map, create, or none`,
    });
  }

  for (const u of used) {
    if (!seen.has(usedKey(u.path, u.ledgerType))) {
      errors.push({
        row: 0,
        message: `missing mapping for ${u.ledgerType} "${u.path}"`,
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, mappings };
}

export type ApplyMappingsResult = {
  /** path+ledgerType → categoryId (null for none) */
  resolvedIds: Map<string, number | null>;
  createdCategories: number;
};

/**
 * Apply mappings inside a transaction: validate map targets, create missing paths.
 */
export async function applyCategoryMappings(
  db: Db,
  userId: number,
  mappings: ImportCategoryMapping[],
  used: UsedImportCategory[],
  owned: OwnedCategoryRow[],
): Promise<ApplyMappingsResult> {
  const usedByKey = new Map(used.map((u) => [usedKey(u.path, u.ledgerType), u]));
  const byId = new Map(owned.map((c) => [c.id, c]));
  const nameKeyIndex = new Map<string, OwnedCategoryRow>();
  for (const c of owned) {
    nameKeyIndex.set(categoryNameKey(c.parentId, c.name), c);
  }

  const resolvedIds = new Map<string, number | null>();
  let createdCategories = 0;

  for (const mapping of mappings) {
    const key = usedKey(mapping.path, mapping.ledgerType);
    const usedCat = usedByKey.get(key);
    if (!usedCat) {
      throw badRequest(`unexpected mapping for ${mapping.ledgerType} "${mapping.path}"`);
    }

    if (mapping.action === "none") {
      resolvedIds.set(key, null);
      continue;
    }

    if (mapping.action === "map") {
      const cat = byId.get(mapping.categoryId);
      if (!cat) {
        throw badRequest(
          `categoryId ${mapping.categoryId} not found for mapping "${mapping.path}"`,
        );
      }
      if (cat.ledgerType !== mapping.ledgerType) {
        throw badRequest(
          `mapped category ledgerType must match ${mapping.ledgerType} for "${mapping.path}"`,
        );
      }
      resolvedIds.set(key, cat.id);
      continue;
    }

    // create path
    let parentId: number | null = null;
    let leafId: number | null = null;
    for (const segment of usedCat.segments) {
      const nk = categoryNameKey(parentId, segment);
      const existing = nameKeyIndex.get(nk);
      if (existing) {
        if (existing.ledgerType !== mapping.ledgerType) {
          throw badRequest(
            `cannot create path "${mapping.path}": segment "${segment}" exists with ledgerType ${existing.ledgerType}`,
          );
        }
        parentId = existing.id;
        leafId = existing.id;
        continue;
      }
      // Explicit type: Prisma's recursive Category.parentId otherwise makes TS7022.
      const created: Category = await db.category.create({
        data: {
          userId,
          name: segment,
          parentId,
          ledgerType: mapping.ledgerType,
          nameKey: nk,
        },
      });
      createdCategories += 1;
      const row: OwnedCategoryRow = {
        id: created.id,
        name: created.name,
        parentId: created.parentId,
        ledgerType: created.ledgerType,
      };
      byId.set(row.id, row);
      nameKeyIndex.set(nk, row);
      parentId = created.id;
      leafId = created.id;
    }
    if (leafId == null) {
      throw badRequest(`cannot create empty path "${mapping.path}"`);
    }
    resolvedIds.set(key, leafId);
  }

  return { resolvedIds, createdCategories };
}

/** Attach resolved categoryId to each draft after mappings are applied. */
export function resolveDraftsWithMappings(
  drafts: CashLedgerImportDraft[],
  resolvedIds: Map<string, number | null>,
): CashLedgerImportResolved[] {
  return drafts.map((draft) => {
    let categoryId: number | null = null;
    if (draft.categoryPath && draft.categoryPath.length > 0) {
      const path = formatCategoryPath(draft.categoryPath);
      const key = usedKey(path, draft.type);
      if (!resolvedIds.has(key)) {
        throw badRequest(`missing resolved category for ${draft.type} "${path}"`);
      }
      categoryId = resolvedIds.get(key) ?? null;
    }
    return {
      row: draft.row,
      type: draft.type,
      amount: draft.amount,
      occurredAt: draft.occurredAt,
      description: draft.description,
      categoryId,
    };
  });
}
