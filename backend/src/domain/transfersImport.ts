import type { Prisma, PrismaClient } from "@prisma/client";
import { decimalToMinor } from "./money";
import type { TransferInput } from "./cashTransfers";
import type { TransferCsvDraft } from "./transfersCsv";
import type { ImportRowError } from "./cashLedgerCsvImport";
import {
  buildCategoryPathMap,
  categoryPathKey,
  parseCategoryPath,
} from "./cashLedgerCsv";

type Db = PrismaClient | Prisma.TransactionClient;

/** Safety cap when scanning transfer history for import dedup. */
export const TRANSFER_IMPORT_DEDUP_SCAN_LIMIT = 50_000;

export type OwnedTransferCategory = {
  id: number;
  name: string;
  parentId: number | null;
  ledgerType: string;
};

/** Build path → id map for owned TRANSFER categories (case-insensitive path key). */
export function buildTransferCategoryPathIndex(
  owned: OwnedTransferCategory[],
): Map<string, number> {
  const transferOnly = owned.filter((c) => c.ledgerType === "TRANSFER");
  const pathById = buildCategoryPathMap(transferOnly);
  const index = new Map<string, number>();
  for (const cat of transferOnly) {
    const pathStr = pathById.get(cat.id);
    if (!pathStr) continue;
    const parsed = parseCategoryPath(pathStr);
    if (!parsed.ok) continue;
    index.set(categoryPathKey(parsed.segments), cat.id);
  }
  return index;
}

export type UsedTransferAccount = {
  name: string;
  currency: string;
  rowCount: number;
};

export type OwnedAccountForImport = {
  id: number;
  name: string;
  currency: string;
};

export type AccountImportPreview = {
  name: string;
  currency: string;
  rowCount: number;
  suggestedAccountId: number | null;
};

export type AccountMapping = {
  name: string;
  currency: string;
  accountId: number;
};

export type ResolvedTransferRow = {
  row: number;
  input: TransferInput;
  duplicate: boolean;
};

function accountKey(name: string, currency: string): string {
  return `${currency}\0${name.trim().toLowerCase()}`;
}

/** Collect unique (name, currency) pairs referenced as from/to in drafts. */
export function collectUsedAccounts(
  drafts: TransferCsvDraft[],
): UsedTransferAccount[] {
  const map = new Map<string, UsedTransferAccount>();
  function bump(name: string, currency: string) {
    const key = accountKey(name, currency);
    const existing = map.get(key);
    if (existing) {
      existing.rowCount += 1;
    } else {
      map.set(key, { name, currency, rowCount: 1 });
    }
  }
  for (const draft of drafts) {
    bump(draft.fromName, draft.fromCurrency);
    bump(draft.toName, draft.toCurrency);
  }
  return [...map.values()].sort((a, b) =>
    a.currency === b.currency
      ? a.name.localeCompare(b.name)
      : a.currency.localeCompare(b.currency),
  );
}

/** Exact case-insensitive name + matching currency suggestion. */
export function suggestAccountMatches(
  used: UsedTransferAccount[],
  owned: OwnedAccountForImport[],
): AccountImportPreview[] {
  const byKey = new Map<string, number>();
  for (const account of owned) {
    const key = accountKey(account.name, account.currency);
    if (!byKey.has(key)) byKey.set(key, account.id);
  }
  return used.map((u) => ({
    name: u.name,
    currency: u.currency,
    rowCount: u.rowCount,
    suggestedAccountId: byKey.get(accountKey(u.name, u.currency)) ?? null,
  }));
}

export type ParseAccountMappingsResult =
  | { ok: true; mappings: AccountMapping[]; byKey: Map<string, number> }
  | { ok: false; errors: ImportRowError[] };

/**
 * Validate that accountMappings cover every used (name, currency) exactly once
 * and that mapped accounts exist with matching currency.
 */
export function parseAccountMappings(
  body: unknown,
  used: UsedTransferAccount[],
  owned: OwnedAccountForImport[],
): ParseAccountMappingsResult {
  if (!Array.isArray(body)) {
    return {
      ok: false,
      errors: [{ row: 0, message: "accountMappings array required" }],
    };
  }

  const ownedById = new Map(owned.map((a) => [a.id, a]));
  const usedKeys = new Set(used.map((u) => accountKey(u.name, u.currency)));
  const seen = new Set<string>();
  const mappings: AccountMapping[] = [];
  const byKey = new Map<string, number>();
  const errors: ImportRowError[] = [];

  for (let i = 0; i < body.length; i++) {
    const item = body[i];
    if (!item || typeof item !== "object") {
      errors.push({ row: 0, message: `accountMappings[${i}] must be an object` });
      continue;
    }
    const raw = item as Record<string, unknown>;
    const name = String(raw.name ?? "").trim();
    const currency = String(raw.currency ?? "").trim().toUpperCase();
    const accountId = Number(raw.accountId);

    if (!name) {
      errors.push({ row: 0, message: `accountMappings[${i}].name required` });
      continue;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push({
        row: 0,
        message: `accountMappings[${i}].currency must be a 3-letter code`,
      });
      continue;
    }
    if (!Number.isInteger(accountId) || accountId < 1) {
      errors.push({
        row: 0,
        message: `accountMappings[${i}].accountId must be a valid id`,
      });
      continue;
    }

    const key = accountKey(name, currency);
    if (!usedKeys.has(key)) {
      errors.push({
        row: 0,
        message: `accountMappings[${i}] does not match any account used in the CSV`,
      });
      continue;
    }
    if (seen.has(key)) {
      errors.push({
        row: 0,
        message: `duplicate mapping for ${currency} "${name}"`,
      });
      continue;
    }
    seen.add(key);

    const account = ownedById.get(accountId);
    if (!account) {
      errors.push({
        row: 0,
        message: `accountId ${accountId} not found for mapping "${name}"`,
      });
      continue;
    }
    if (account.currency !== currency) {
      errors.push({
        row: 0,
        message: `mapped account currency must be ${currency} for "${name}"`,
      });
      continue;
    }

    mappings.push({ name, currency, accountId });
    byKey.set(key, accountId);
  }

  for (const u of used) {
    if (!seen.has(accountKey(u.name, u.currency))) {
      errors.push({
        row: 0,
        message: `missing mapping for ${u.currency} "${u.name}"`,
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, mappings, byKey };
}

export type ResolveDraftsResult =
  | { ok: true; rows: Array<{ row: number; input: TransferInput }> }
  | { ok: false; errors: ImportRowError[] };

/**
 * Resolve CSV drafts to TransferInput using validated account mappings
 * and an optional TRANSFER category path index.
 */
export function resolveTransferDrafts(
  drafts: TransferCsvDraft[],
  byKey: Map<string, number>,
  categoryPathIndex: Map<string, number> = new Map(),
): ResolveDraftsResult {
  const errors: ImportRowError[] = [];
  const rows: Array<{ row: number; input: TransferInput }> = [];

  for (const draft of drafts) {
    const fromId = byKey.get(accountKey(draft.fromName, draft.fromCurrency));
    const toId = byKey.get(accountKey(draft.toName, draft.toCurrency));
    if (fromId == null || toId == null) {
      errors.push({
        row: draft.row,
        message: "account mapping incomplete",
      });
      continue;
    }
    if (fromId === toId) {
      errors.push({
        row: draft.row,
        message: "fromAccount and toAccount must map to different accounts",
      });
      continue;
    }

    let categoryId: number | null = null;
    if (draft.categoryPath) {
      const parsed = parseCategoryPath(draft.categoryPath);
      if (!parsed.ok || parsed.segments.length === 0) {
        errors.push({
          row: draft.row,
          message: `unknown transfer category path "${draft.categoryPath}"`,
        });
        continue;
      }
      const id = categoryPathIndex.get(categoryPathKey(parsed.segments));
      if (id == null) {
        errors.push({
          row: draft.row,
          message: `unknown transfer category path "${draft.categoryPath}"`,
        });
        continue;
      }
      categoryId = id;
    }

    rows.push({
      row: draft.row,
      input: {
        fromAccountId: fromId,
        toAccountId: toId,
        amountFrom: draft.amountFrom,
        amountTo: draft.amountTo,
        occurredAt: draft.occurredAt,
        description: draft.description,
        categoryId,
      },
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rows };
}

export type ExistingTransferForDup = {
  fromAccountId: number;
  toAccountId: number;
  amountFrom: number;
  amountTo: number;
  occurredAt: Date;
  description: string | null;
};

/** Pad one UTC day around min/max occurredAt of resolved import rows. */
export function occurredAtWindowForTransferRows(
  rows: Array<{ input: { occurredAt: Date } }>,
): { gte: Date; lte: Date } | null {
  if (rows.length === 0) return null;
  let minMs = Infinity;
  let maxMs = -Infinity;
  for (const row of rows) {
    const ms = row.input.occurredAt.getTime();
    if (ms < minMs) minMs = ms;
    if (ms > maxMs) maxMs = ms;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    gte: new Date(minMs - dayMs),
    lte: new Date(maxMs + dayMs),
  };
}

/** Load existing transfers for dedup, bounded by import date window + scan cap. */
export async function loadExistingTransfersForDedup(
  db: Db,
  userId: number,
  resolvedRows: Array<{ input: { occurredAt: Date } }>,
): Promise<ExistingTransferForDup[]> {
  const window = occurredAtWindowForTransferRows(resolvedRows);
  return db.cashTransfer.findMany({
    where: {
      userId,
      ...(window
        ? { occurredAt: { gte: window.gte, lte: window.lte } }
        : {}),
    },
    select: {
      fromAccountId: true,
      toAccountId: true,
      amountFrom: true,
      amountTo: true,
      occurredAt: true,
      description: true,
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: TRANSFER_IMPORT_DEDUP_SCAN_LIMIT,
  });
}

function transferDupKey(
  fromAccountId: number,
  toAccountId: number,
  amountFromMinor: number,
  amountToMinor: number,
  occurredAt: Date,
  description: string | null,
): string {
  const desc =
    description == null || description.trim() === ""
      ? ""
      : description.trim();
  return [
    fromAccountId,
    toAccountId,
    amountFromMinor,
    amountToMinor,
    occurredAt.getTime(),
    desc,
  ].join("\0");
}

function existingTransferKeys(
  existing: ExistingTransferForDup[],
): Set<string> {
  return new Set(
    existing.map((t) =>
      transferDupKey(
        t.fromAccountId,
        t.toAccountId,
        t.amountFrom,
        t.amountTo,
        t.occurredAt,
        t.description,
      ),
    ),
  );
}

function resolvedRowKey(input: TransferInput): string {
  return transferDupKey(
    input.fromAccountId,
    input.toAccountId,
    decimalToMinor(input.amountFrom, "amountFrom"),
    decimalToMinor(input.amountTo, "amountTo"),
    input.occurredAt,
    input.description,
  );
}

/**
 * Mark resolved rows that match an existing transfer or an earlier row in the
 * same file (intra-file dedup).
 */
export function findDuplicateRows(
  rows: Array<{ row: number; input: TransferInput }>,
  existing: ExistingTransferForDup[],
): ResolvedTransferRow[] {
  const keys = existingTransferKeys(existing);
  return rows.map(({ row, input }) => {
    const key = resolvedRowKey(input);
    const duplicate = keys.has(key);
    if (!duplicate) keys.add(key);
    return { row, input, duplicate };
  });
}

/**
 * Partition resolved rows into create vs skip using ledger fingerprints.
 * Also collapses intra-file duplicates (first wins).
 */
export function partitionTransferRowsByExisting(
  rows: Array<{ row: number; input: TransferInput }>,
  existing: ExistingTransferForDup[],
): {
  toImport: Array<{ row: number; input: TransferInput }>;
  skippedDuplicateRows: number[];
} {
  const keys = existingTransferKeys(existing);
  const toImport: Array<{ row: number; input: TransferInput }> = [];
  const skippedDuplicateRows: number[] = [];
  for (const item of rows) {
    const key = resolvedRowKey(item.input);
    if (keys.has(key)) {
      skippedDuplicateRows.push(item.row);
      continue;
    }
    keys.add(key);
    toImport.push(item);
  }
  return { toImport, skippedDuplicateRows };
}

export type ParseSkipRowsResult =
  | { ok: true; skip: Set<number> }
  | { ok: false; errors: ImportRowError[] };

/** Validate skipRows are a subset of draft row numbers. */
export function parseSkipRows(
  body: unknown,
  validRows: number[],
): ParseSkipRowsResult {
  if (body === undefined || body === null) {
    return { ok: true, skip: new Set() };
  }
  if (!Array.isArray(body)) {
    return {
      ok: false,
      errors: [{ row: 0, message: "skipRows must be an array" }],
    };
  }
  const valid = new Set(validRows);
  const skip = new Set<number>();
  const errors: ImportRowError[] = [];
  for (let i = 0; i < body.length; i++) {
    const n = Number(body[i]);
    if (!Number.isInteger(n) || n < 1) {
      errors.push({
        row: 0,
        message: `skipRows[${i}] must be a positive integer`,
      });
      continue;
    }
    if (!valid.has(n)) {
      errors.push({
        row: 0,
        message: `skipRows[${i}] row ${n} is not in the CSV`,
      });
      continue;
    }
    skip.add(n);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, skip };
}
