import type { Category, Prisma, PrismaClient } from "@prisma/client";
import {
  buildCategoryPathMap,
  categoryPathKey,
  parseCategoryPath,
} from "./cashLedgerCsv";
import type { CategoryCsvDraft } from "./categoriesCsv";
import { categoryNameKey, type CategoryLedgerType } from "./categories";
import { badRequest } from "../lib/errors";

type Db = PrismaClient | Prisma.TransactionClient;

export type OwnedCategoryRow = {
  id: number;
  name: string;
  parentId: number | null;
  ledgerType: string;
};

export type CategoryImportRowStatus = "exists" | "create";

export type CategoryImportPreviewRow = {
  path: string;
  ledgerType: CategoryLedgerType;
  status: CategoryImportRowStatus;
};

export type CategoriesImportPreview = {
  rowCount: number;
  existing: number;
  toCreate: number;
  rows: CategoryImportPreviewRow[];
};

export type CategoriesImportResult = {
  created: number;
  skipped: number;
};

function pathLedgerKey(pathKey: string, ledgerType: string): string {
  return `${ledgerType}\0${pathKey}`;
}

/** Index owned categories by path key and by path→ledgerType for conflict checks. */
function indexOwned(owned: OwnedCategoryRow[]): {
  byPathLedger: Set<string>;
  ledgerByPathKey: Map<string, string>;
  nameKeyIndex: Map<string, OwnedCategoryRow>;
} {
  const pathById = buildCategoryPathMap(owned);
  const byPathLedger = new Set<string>();
  const ledgerByPathKey = new Map<string, string>();
  const nameKeyIndex = new Map<string, OwnedCategoryRow>();

  for (const cat of owned) {
    nameKeyIndex.set(categoryNameKey(cat.parentId, cat.name), cat);
    const pathStr = pathById.get(cat.id);
    if (!pathStr) continue;
    const parsed = parseCategoryPath(pathStr);
    if (!parsed.ok) continue;
    const pk = categoryPathKey(parsed.segments);
    byPathLedger.add(pathLedgerKey(pk, cat.ledgerType));
    const prior = ledgerByPathKey.get(pk);
    if (prior !== undefined && prior !== cat.ledgerType) {
      // corrupt tree — treat as conflict source later
    }
    ledgerByPathKey.set(pk, cat.ledgerType);
  }

  return { byPathLedger, ledgerByPathKey, nameKeyIndex };
}

/**
 * Preview merge: exact path+ledgerType → exists; missing → create;
 * same path with different ledgerType on owned tree → error.
 */
export function previewCategoriesImport(
  drafts: CategoryCsvDraft[],
  owned: OwnedCategoryRow[],
): { ok: true; preview: CategoriesImportPreview } | { ok: false; message: string } {
  const { byPathLedger, ledgerByPathKey } = indexOwned(owned);
  const rows: CategoryImportPreviewRow[] = [];
  let existing = 0;
  let toCreate = 0;

  for (const draft of drafts) {
    const pk = categoryPathKey(draft.segments);
    const ownedLedger = ledgerByPathKey.get(pk);
    if (ownedLedger !== undefined && ownedLedger !== draft.ledgerType) {
      return {
        ok: false,
        message: `path "${draft.path}" exists with ledgerType ${ownedLedger}, CSV has ${draft.ledgerType}`,
      };
    }
    if (byPathLedger.has(pathLedgerKey(pk, draft.ledgerType))) {
      rows.push({
        path: draft.path,
        ledgerType: draft.ledgerType,
        status: "exists",
      });
      existing += 1;
    } else {
      rows.push({
        path: draft.path,
        ledgerType: draft.ledgerType,
        status: "create",
      });
      toCreate += 1;
    }
  }

  return {
    ok: true,
    preview: {
      rowCount: drafts.length,
      existing,
      toCreate,
      rows,
    },
  };
}

/**
 * Apply merge import: create missing paths (parents first via sorted drafts).
 * Returns created leaf-or-path count (number of CSV rows that created at least
 * the leaf) and skipped existing rows.
 */
export async function applyCategoriesImport(
  db: Db,
  userId: number,
  drafts: CategoryCsvDraft[],
  owned: OwnedCategoryRow[],
): Promise<CategoriesImportResult> {
  const checked = previewCategoriesImport(drafts, owned);
  if (!checked.ok) {
    throw badRequest(checked.message);
  }

  const { byPathLedger, nameKeyIndex } = indexOwned(owned);
  const workingNameKey = new Map(nameKeyIndex);
  const workingPathLedger = new Set(byPathLedger);

  let created = 0;
  let skipped = 0;

  for (const draft of drafts) {
    const pk = categoryPathKey(draft.segments);
    const fullKey = pathLedgerKey(pk, draft.ledgerType);
    if (workingPathLedger.has(fullKey)) {
      skipped += 1;
      continue;
    }

    let parentId: number | null = null;
    for (const segment of draft.segments) {
      const nk = categoryNameKey(parentId, segment);
      const existing = workingNameKey.get(nk);
      if (existing) {
        if (existing.ledgerType !== draft.ledgerType) {
          throw badRequest(
            `cannot create path "${draft.path}": segment "${segment}" exists with ledgerType ${existing.ledgerType}`,
          );
        }
        parentId = existing.id;
        continue;
      }
      const row: Category = await db.category.create({
        data: {
          userId,
          name: segment,
          parentId,
          ledgerType: draft.ledgerType,
          nameKey: nk,
        },
      });
      const ownedRow: OwnedCategoryRow = {
        id: row.id,
        name: row.name,
        parentId: row.parentId,
        ledgerType: row.ledgerType,
      };
      workingNameKey.set(nk, ownedRow);
      parentId = row.id;
    }
    workingPathLedger.add(fullKey);
    created += 1;
  }

  return { created, skipped };
}
