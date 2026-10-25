import type { PrismaClient } from "@prisma/client";
import { createTransfer } from "./cashTransfers";
import {
  formatImportErrors,
  parseTransfersCsv,
} from "./transfersCsv";
import {
  buildTransferCategoryPathIndex,
  collectUsedAccounts,
  findDuplicateRows,
  loadExistingTransfersForDedup,
  parseAccountMappings,
  parseSkipRows,
  partitionTransferRowsByExisting,
  resolveTransferDrafts,
  suggestAccountMatches,
  type AccountImportPreview,
} from "./transfersImport";
import { badRequest } from "../lib/errors";

export type TransferImportPreviewRow = {
  row: number;
  occurredAt: string;
  fromAccountId: number;
  toAccountId: number;
  amountFrom: number;
  amountTo: number;
  description: string | null;
  duplicate: boolean;
};

export type TransferImportPreviewResult = {
  rowCount: number;
  accounts: AccountImportPreview[];
  rows: TransferImportPreviewRow[];
};

async function loadOwnedAccountsForImport(
  prisma: PrismaClient,
  userId: number,
) {
  return prisma.account.findMany({
    where: { userId },
    select: { id: true, name: true, currency: true },
  });
}

async function loadTransferCategoryIndex(
  prisma: PrismaClient,
  userId: number,
) {
  const transferCategories = await prisma.category.findMany({
    where: { userId, ledgerType: "TRANSFER" },
    select: { id: true, name: true, parentId: true, ledgerType: true },
  });
  return buildTransferCategoryPathIndex(transferCategories);
}

function throwImportErrors(
  errors: { row: number; message: string }[],
): never {
  throw badRequest(formatImportErrors(errors));
}

/**
 * Preview transfer CSV import. When accountMappings are provided, resolve
 * rows and mark ledger/intra-file duplicates.
 */
export async function previewTransferImport(
  prisma: PrismaClient,
  userId: number,
  csv: string,
  accountMappingsBody: unknown | undefined,
): Promise<TransferImportPreviewResult> {
  const parsed = parseTransfersCsv(csv);
  if (!parsed.ok) throwImportErrors(parsed.errors);

  const owned = await loadOwnedAccountsForImport(prisma, userId);
  const used = collectUsedAccounts(parsed.drafts);
  const accounts = suggestAccountMatches(used, owned);
  const body: TransferImportPreviewResult = {
    rowCount: parsed.drafts.length,
    accounts,
    rows: [],
  };

  if (accountMappingsBody === undefined) {
    return body;
  }

  const mappings = parseAccountMappings(accountMappingsBody, used, owned);
  if (!mappings.ok) throwImportErrors(mappings.errors);

  const categoryPathIndex = await loadTransferCategoryIndex(prisma, userId);
  const resolved = resolveTransferDrafts(
    parsed.drafts,
    mappings.byKey,
    categoryPathIndex,
  );
  if (!resolved.ok) throwImportErrors(resolved.errors);

  const existing = await loadExistingTransfersForDedup(
    prisma,
    userId,
    resolved.rows,
  );
  const marked = findDuplicateRows(resolved.rows, existing);
  body.rows = marked.map((r) => ({
    row: r.row,
    occurredAt: r.input.occurredAt.toISOString(),
    fromAccountId: r.input.fromAccountId,
    toAccountId: r.input.toAccountId,
    amountFrom: Number(r.input.amountFrom),
    amountTo: Number(r.input.amountTo),
    description: r.input.description,
    duplicate: r.duplicate,
  }));
  return body;
}

/**
 * Commit transfer CSV import. Client skipRows are applied first; remaining
 * rows are re-checked against the ledger inside the write transaction
 * (mirror cash import fingerprint re-check).
 */
export async function commitTransferImport(
  prisma: PrismaClient,
  userId: number,
  csv: string,
  accountMappingsBody: unknown,
  skipRowsBody: unknown,
): Promise<{ created: number; skipped: number }> {
  const parsed = parseTransfersCsv(csv);
  if (!parsed.ok) throwImportErrors(parsed.errors);

  const owned = await loadOwnedAccountsForImport(prisma, userId);
  const used = collectUsedAccounts(parsed.drafts);
  const mappings = parseAccountMappings(accountMappingsBody, used, owned);
  if (!mappings.ok) throwImportErrors(mappings.errors);

  const categoryPathIndex = await loadTransferCategoryIndex(prisma, userId);
  const resolved = resolveTransferDrafts(
    parsed.drafts,
    mappings.byKey,
    categoryPathIndex,
  );
  if (!resolved.ok) throwImportErrors(resolved.errors);

  const skipParsed = parseSkipRows(
    skipRowsBody,
    resolved.rows.map((r) => r.row),
  );
  if (!skipParsed.ok) throwImportErrors(skipParsed.errors);

  const clientCandidates = resolved.rows.filter(
    (r) => !skipParsed.skip.has(r.row),
  );
  const clientSkipped = resolved.rows.length - clientCandidates.length;

  return prisma.$transaction(async (tx) => {
    const existing = await loadExistingTransfersForDedup(
      tx,
      userId,
      clientCandidates,
    );
    const { toImport, skippedDuplicateRows } = partitionTransferRowsByExisting(
      clientCandidates,
      existing,
    );
    for (const item of toImport) {
      await createTransfer(tx, userId, item.input);
    }
    return {
      created: toImport.length,
      skipped: clientSkipped + skippedDuplicateRows.length,
    };
  });
}
