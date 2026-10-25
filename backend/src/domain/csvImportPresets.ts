import type { CsvImportPreset, Prisma, PrismaClient } from "@prisma/client";
import { badRequest, notFound } from "../lib/errors";
import {
  parseColumnMapping,
  type AmountSignMode,
  type ColumnMapping,
} from "./csvColumnMap";

type Db = PrismaClient | Prisma.TransactionClient;

export type NamedColumnMapping = {
  occurredAt: string;
  amount: string;
  description?: string | null;
  type?: string | null;
  categoryPath?: string | null;
  amountSignMode?: AmountSignMode;
};

const MAPPING_FIELDS = [
  "occurredAt",
  "amount",
  "description",
  "type",
  "categoryPath",
] as const;

export function presetNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function parsePresetName(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) throw badRequest("name required");
  if (text.length > 80) throw badRequest("name must be at most 80 characters");
  return text;
}

/**
 * Resolve columnMapping (indices or names) against headers and store header names only.
 */
export function serializeNamedMapping(
  headers: string[],
  columnMappingRaw: unknown,
): NamedColumnMapping {
  if (!Array.isArray(headers) || headers.length === 0) {
    throw badRequest("headers array required");
  }
  const normalizedHeaders = headers.map((h) => String(h ?? ""));
  const mapping = parseColumnMapping(columnMappingRaw, normalizedHeaders);
  return namedMappingFromResolved(mapping, normalizedHeaders);
}

export function namedMappingFromResolved(
  mapping: ColumnMapping,
  headers: string[],
): NamedColumnMapping {
  const nameAt = (idx: number | null | undefined): string | null => {
    if (idx == null) return null;
    const h = headers[idx];
    if (h === undefined) throw badRequest("column index out of range");
    return h;
  };

  const occurredAt = nameAt(mapping.occurredAt);
  const amount = nameAt(mapping.amount);
  if (occurredAt == null || amount == null) {
    throw badRequest("occurredAt and amount required");
  }

  const out: NamedColumnMapping = {
    occurredAt,
    amount,
    description: nameAt(mapping.description ?? null),
    type: nameAt(mapping.type ?? null),
    categoryPath: nameAt(mapping.categoryPath ?? null),
  };
  if (out.type == null) {
    if (mapping.amountSignMode == null) {
      throw badRequest(
        "amountSignMode is required when type column is not mapped",
      );
    }
    out.amountSignMode = mapping.amountSignMode;
  }
  return out;
}

export function parseStoredMapping(json: string): NamedColumnMapping {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw badRequest("invalid preset mappingJson");
  }
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw badRequest("invalid preset mappingJson");
  }
  const body = raw as Record<string, unknown>;
  const occurredAt = requireHeaderName(body.occurredAt, "occurredAt");
  const amount = requireHeaderName(body.amount, "amount");
  const description = optionalHeaderName(body.description, "description");
  const type = optionalHeaderName(body.type, "type");
  const categoryPath = optionalHeaderName(body.categoryPath, "categoryPath");

  let amountSignMode: AmountSignMode | undefined;
  if (body.amountSignMode !== undefined && body.amountSignMode !== null) {
    const mode = String(body.amountSignMode);
    if (mode !== "negativeIsExpense" && mode !== "negativeIsIncome") {
      throw badRequest(
        'amountSignMode must be "negativeIsExpense" or "negativeIsIncome"',
      );
    }
    amountSignMode = mode;
  }
  if (type == null && amountSignMode == null) {
    throw badRequest(
      "amountSignMode is required when type column is not mapped",
    );
  }

  const names = [occurredAt, amount];
  for (const n of [description, type, categoryPath]) {
    if (n == null) continue;
    if (names.some((x) => x.toLowerCase() === n.toLowerCase())) {
      throw badRequest("columnMapping fields must use distinct columns");
    }
    names.push(n);
  }

  return {
    occurredAt,
    amount,
    description,
    type,
    categoryPath,
    amountSignMode: type == null ? amountSignMode : undefined,
  };
}

function requireHeaderName(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw badRequest(`${field} header name required`);
  }
  return value.trim();
}

function optionalHeaderName(
  value: unknown,
  field: string,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw badRequest(`${field} must be a header name string`);
  }
  const t = value.trim();
  return t || null;
}

/** Body suitable for parseColumnMapping (header name refs). */
export function toColumnMappingBody(
  stored: NamedColumnMapping,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    occurredAt: stored.occurredAt,
    amount: stored.amount,
  };
  if (stored.description != null) body.description = stored.description;
  if (stored.type != null) body.type = stored.type;
  if (stored.categoryPath != null) body.categoryPath = stored.categoryPath;
  if (stored.type == null && stored.amountSignMode != null) {
    body.amountSignMode = stored.amountSignMode;
  }
  return body;
}

export function findMatchingPresetId(
  presets: Array<{ id: number; mappingJson: string }>,
  headers: string[],
): number | null {
  const headerKeys = new Set(
    headers.map((h) => h.trim().toLowerCase()).filter(Boolean),
  );
  for (const preset of presets) {
    let stored: NamedColumnMapping;
    try {
      stored = parseStoredMapping(preset.mappingJson);
    } catch {
      continue;
    }
    const required = [stored.occurredAt, stored.amount];
    for (const opt of [
      stored.description,
      stored.type,
      stored.categoryPath,
    ]) {
      if (opt != null) required.push(opt);
    }
    if (
      required.every((name) => headerKeys.has(name.trim().toLowerCase()))
    ) {
      return preset.id;
    }
  }
  return null;
}

export function csvImportPresetPayload(row: CsvImportPreset) {
  const mapping = parseStoredMapping(row.mappingJson);
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    mapping,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findOwnedCsvImportPreset(
  db: Db,
  userId: number,
  accountId: number,
  id: number,
): Promise<CsvImportPreset> {
  const row = await db.csvImportPreset.findFirst({
    where: { id, userId, accountId },
  });
  if (!row) throw notFound("Import preset not found");
  return row;
}

export async function assertPresetNameUnique(
  db: Db,
  accountId: number,
  name: string,
  excludeId?: number,
): Promise<void> {
  const key = presetNameKey(name);
  const existing = await db.csvImportPreset.findFirst({
    where: {
      accountId,
      nameKey: key,
      ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw badRequest("A preset with this name already exists on this account");
  }
}

/** Exported for tests — field list. */
export function namedMappingFieldKeys(): readonly string[] {
  return MAPPING_FIELDS;
}
