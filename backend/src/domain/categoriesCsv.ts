import {
  categoryPathKey,
  escapeCsvCell,
  formatCategoryPath,
  parseCategoryPath,
} from "./cashLedgerCsv";
import {
  splitCsvRecords,
  stripBom,
  type ImportRowError,
} from "./cashLedgerCsvImport";
import type { CategoryLedgerType } from "./categories";

export const CATEGORIES_CSV_HEADER = "path,ledgerType" as const;

const HEADER_COLUMNS = CATEGORIES_CSV_HEADER.split(",");

export type CategoriesCsvRow = {
  path: string;
  ledgerType: CategoryLedgerType;
};

export type CategoryCsvDraft = {
  /** 1-based data row index (header excluded). */
  row: number;
  path: string;
  ledgerType: CategoryLedgerType;
  segments: string[];
};

export type ParseCategoriesResult =
  | { ok: true; drafts: CategoryCsvDraft[] }
  | { ok: false; errors: ImportRowError[] };

/**
 * Build UTF-8 CSV (no BOM). Rows sorted parents-before-children
 * (by segment count, then path).
 */
function segmentCount(path: string): number {
  const parsed = parseCategoryPath(path);
  return parsed.ok ? parsed.segments.length : path.length;
}

export function buildCategoriesCsv(rows: CategoriesCsvRow[]): string {
  const sorted = [...rows].sort((a, b) => {
    const aSegs = segmentCount(a.path);
    const bSegs = segmentCount(b.path);
    if (aSegs !== bSegs) return aSegs - bSegs;
    return a.path.localeCompare(b.path);
  });
  const lines: string[] = [CATEGORIES_CSV_HEADER];
  for (const row of sorted) {
    lines.push(
      [escapeCsvCell(row.path), escapeCsvCell(row.ledgerType)].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function categoriesExportFilename(): string {
  return "categories.csv";
}

export function parseCategoriesCsv(csv: string): ParseCategoriesResult {
  const text = stripBom(String(csv ?? ""))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = splitCsvRecords(text);
  if (lines.length === 0) {
    return { ok: false, errors: [{ row: 0, message: "CSV header required" }] };
  }

  const headerJoined = lines[0]!.join(",");
  if (headerJoined !== CATEGORIES_CSV_HEADER) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          message: `CSV header must be: ${CATEGORIES_CSV_HEADER}`,
        },
      ],
    };
  }

  const errors: ImportRowError[] = [];
  const drafts: CategoryCsvDraft[] = [];
  const seen = new Map<string, CategoryLedgerType>();

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!;
    const dataRow = i;
    if (cells.length === 1 && cells[0] === "") continue;
    if (cells.length !== HEADER_COLUMNS.length) {
      errors.push({
        row: dataRow,
        message: `expected ${HEADER_COLUMNS.length} columns, got ${cells.length}`,
      });
      continue;
    }

    const pathRaw = cells[0]!.trim();
    const ledgerRaw = cells[1]!.trim().toUpperCase();

    if (
      ledgerRaw !== "INCOME" &&
      ledgerRaw !== "EXPENSE" &&
      ledgerRaw !== "TRANSFER"
    ) {
      errors.push({
        row: dataRow,
        message: "ledgerType must be INCOME, EXPENSE, or TRANSFER",
      });
      continue;
    }
    const ledgerType: CategoryLedgerType = ledgerRaw;

    const pathResult = parseCategoryPath(pathRaw);
    if (!pathResult.ok) {
      errors.push({ row: dataRow, message: pathResult.message });
      continue;
    }
    if (pathResult.segments.length === 0) {
      errors.push({ row: dataRow, message: "path is required" });
      continue;
    }

    const path = formatCategoryPath(pathResult.segments);
    const key = categoryPathKey(pathResult.segments);
    const prior = seen.get(key);
    if (prior !== undefined) {
      if (prior !== ledgerType) {
        errors.push({
          row: dataRow,
          message: `path "${path}" appears with conflicting ledgerType values`,
        });
      }
      // duplicate same ledgerType — skip extra row
      continue;
    }
    seen.set(key, ledgerType);

    drafts.push({
      row: dataRow,
      path,
      ledgerType,
      segments: pathResult.segments,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  drafts.sort((a, b) => {
    if (a.segments.length !== b.segments.length) {
      return a.segments.length - b.segments.length;
    }
    return a.path.localeCompare(b.path);
  });

  return { ok: true, drafts };
}
