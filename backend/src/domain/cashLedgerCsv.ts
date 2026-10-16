import { Prisma } from "@prisma/client";

export const CASH_LEDGER_CSV_HEADER =
  "id,type,amount,currency,occurredAt,description,categoryPath,createdAt" as const;

/** Previous export header (319e8fa) — accepted on import via legacyCategoryId enrichment. */
export const LEGACY_CASH_LEDGER_CSV_HEADER =
  "id,type,amount,currency,occurredAt,description,categoryId,categoryName,createdAt" as const;

export type CashLedgerCsvRow = {
  id: number;
  type: string;
  amount: number;
  occurredAt: Date | string;
  description: string | null;
  categoryPath: string | null;
  createdAt: Date | string;
};

/** Escape `/` and `\` in a single path segment. */
export function escapeCategoryPathSegment(segment: string): string {
  return segment.replace(/\\/g, "\\\\").replace(/\//g, "\\/");
}

/** Join path segments with `/` after escaping. */
export function formatCategoryPath(segments: string[]): string {
  return segments.map(escapeCategoryPathSegment).join("/");
}

export type ParseCategoryPathResult =
  | { ok: true; segments: string[] }
  | { ok: false; message: string };

/**
 * Parse a category path string into segments.
 * Empty / whitespace → no category (`segments: []`).
 */
export function parseCategoryPath(raw: string): ParseCategoryPathResult {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { ok: true, segments: [] };

  const segments: string[] = [];
  let current = "";
  let i = 0;
  while (i < trimmed.length) {
    const ch = trimmed[i]!;
    if (ch === "\\") {
      const next = trimmed[i + 1];
      if (next === "\\" || next === "/") {
        current += next;
        i += 2;
        continue;
      }
      return { ok: false, message: "categoryPath has invalid escape" };
    }
    if (ch === "/") {
      const name = current.trim();
      if (!name) {
        return { ok: false, message: "categoryPath has empty segment" };
      }
      if (name.length > 80) {
        return { ok: false, message: "categoryPath segment must be at most 80 characters" };
      }
      segments.push(name);
      current = "";
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }

  const last = current.trim();
  if (!last) {
    return { ok: false, message: "categoryPath has empty segment" };
  }
  if (last.length > 80) {
    return { ok: false, message: "categoryPath segment must be at most 80 characters" };
  }
  segments.push(last);
  return { ok: true, segments };
}

/** Case-insensitive path key for matching. */
export function categoryPathKey(segments: string[]): string {
  return segments.map((s) => s.trim().toLowerCase()).join("\0");
}

/**
 * Build id → formatted path for a user's category tree.
 * Orphans / cycles yield no entry (skipped).
 */
export function buildCategoryPathMap(
  categories: Array<{ id: number; name: string; parentId: number | null }>,
): Map<number, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const cache = new Map<number, string[] | null>();

  function segmentsFor(id: number, stack: Set<number>): string[] | null {
    if (cache.has(id)) return cache.get(id)!;
    if (stack.has(id)) {
      cache.set(id, null);
      return null;
    }
    const cat = byId.get(id);
    if (!cat) {
      cache.set(id, null);
      return null;
    }
    stack.add(id);
    let segments: string[] | null;
    if (cat.parentId == null) {
      segments = [cat.name];
    } else {
      const parentSegs = segmentsFor(cat.parentId, stack);
      segments = parentSegs ? [...parentSegs, cat.name] : null;
    }
    stack.delete(id);
    cache.set(id, segments);
    return segments;
  }

  const result = new Map<number, string>();
  for (const cat of categories) {
    const segs = segmentsFor(cat.id, new Set());
    if (segs) result.set(cat.id, formatCategoryPath(segs));
  }
  return result;
}

/** RFC4180 field escape + Excel formula-injection neutralization. */
export function escapeCsvCell(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  return new Prisma.Decimal(amount.toString()).toDecimalPlaces(2).toFixed(2);
}

function formatIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}

/**
 * Build a UTF-8 CSV (no BOM) for one account's cash ledger.
 * Caller supplies rows already ordered (oldest → newest).
 */
export function buildCashLedgerCsv(input: {
  currency: string;
  rows: CashLedgerCsvRow[];
}): string {
  const currency = String(input.currency || "").toUpperCase();
  const lines: string[] = [CASH_LEDGER_CSV_HEADER];

  for (const row of input.rows) {
    const cells = [
      String(row.id),
      escapeCsvCell(String(row.type)),
      formatAmount(Number(row.amount)),
      escapeCsvCell(currency),
      escapeCsvCell(formatIso(row.occurredAt)),
      escapeCsvCell(row.description ?? ""),
      escapeCsvCell(row.categoryPath ?? ""),
      escapeCsvCell(formatIso(row.createdAt)),
    ];
    lines.push(cells.join(","));
  }

  return `${lines.join("\n")}\n`;
}

export function cashLedgerExportFilename(accountId: number): string {
  return `account-${accountId}-cash.csv`;
}
