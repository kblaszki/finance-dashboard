import type { PrismaClient } from "@prisma/client";
import {
  parsePositiveAmount,
  postCashTransactionBatch,
} from "./cashLedger";
import type {
  CashLedgerImportDraft,
  ImportRowError,
  SkippedTransferRow,
} from "./cashLedgerCsvImport";
import {
  applyCategoryMappings,
  collectUsedCategories,
  enrichLegacyCategoryPaths,
  parseCategoryMappings,
  resolveDraftsWithMappings,
  suggestCategoryMatches,
  type ImportCategoryMapping,
} from "./cashLedgerImportCategories";
import {
  createImportBatch,
  loadAccountImportFingerprints,
  partitionDraftsByExisting,
  type SkippedDuplicateRow,
} from "./cashImportDedup";
import {
  applyDescriptionMappings,
  buildDescriptionSuggestions,
  collectUsedDescriptions,
  parseDescriptionMappings,
  upsertExactDescriptionRule,
  type DescriptionMapping,
} from "./categoryDescriptionSuggest";
import { expectedCategoryLedgerType } from "./categories";
import { badRequest, notFound } from "../lib/errors";

type OwnedCategory = {
  id: number;
  name: string;
  parentId: number | null;
  ledgerType: string;
};

async function assertOwnedCategoryForTx(
  prisma: PrismaClient,
  userId: number,
  categoryId: number | null,
  txType: string,
): Promise<number | null> {
  if (categoryId === null) return null;
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true, ledgerType: true },
  });
  if (!category) throw notFound("Category not found");
  const expected = expectedCategoryLedgerType(txType);
  if (category.ledgerType !== expected) {
    throw badRequest("category ledgerType must match transaction type");
  }
  return category.id;
}

export async function assertDescriptionMapCategories(
  prisma: PrismaClient,
  userId: number,
  mappings: DescriptionMapping[],
): Promise<void> {
  for (const m of mappings) {
    if (m.action !== "map") continue;
    await assertOwnedCategoryForTx(prisma, userId, m.categoryId, m.ledgerType);
  }
}

export async function buildCategoryImportPreview(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
  draftsIn: CashLedgerImportDraft[],
  skippedTransfers: SkippedTransferRow[],
): Promise<{
  rowCount: number;
  categories: ReturnType<typeof suggestCategoryMatches>;
  descriptionSuggestions: Awaited<
    ReturnType<typeof buildDescriptionSuggestions>
  >;
  skipped: number;
  skippedTransfers: SkippedTransferRow[];
  duplicateCount: number;
  skippedDuplicates: SkippedDuplicateRow[];
}> {
  const ownedCategories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, name: true, parentId: true, ledgerType: true },
  });
  const drafts = enrichLegacyCategoryPaths(draftsIn, ownedCategories);
  const fingerprints = await loadAccountImportFingerprints(prisma, accountId, {
    drafts,
  });
  const { toImport, skippedDuplicates } = partitionDraftsByExisting(
    drafts,
    fingerprints,
  );
  const used = collectUsedCategories(toImport);
  const categories = suggestCategoryMatches(used, ownedCategories);
  const descriptionSuggestions = await buildDescriptionSuggestions(
    prisma,
    userId,
    toImport,
    ownedCategories,
  );
  return {
    rowCount: toImport.length,
    categories,
    descriptionSuggestions,
    skipped: skippedTransfers.length,
    skippedTransfers,
    duplicateCount: skippedDuplicates.length,
    skippedDuplicates,
  };
}

export async function persistMappedImport(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
  toImport: CashLedgerImportDraft[],
  skippedDuplicates: SkippedDuplicateRow[],
  skippedTransferCount: number,
  source: "ledger_csv" | "columns_csv",
  categoryMappings: ImportCategoryMapping[],
  descriptionMappings: DescriptionMapping[],
  ownedCategories: OwnedCategory[],
  used: ReturnType<typeof collectUsedCategories>,
): Promise<{ created: number; createdCategories: number }> {
  return prisma.$transaction(async (tx) => {
    const fingerprints = await loadAccountImportFingerprints(tx, accountId, {
      drafts: toImport,
    });
    const { toImport: fresh, skippedDuplicates: raced } =
      partitionDraftsByExisting(toImport, fingerprints);
    const allSkipped = [...skippedDuplicates, ...raced];
    const applied = await applyCategoryMappings(
      tx,
      userId,
      categoryMappings,
      used,
      ownedCategories,
    );
    let resolved = resolveDraftsWithMappings(fresh, applied.resolvedIds);
    resolved = applyDescriptionMappings(
      resolved,
      fresh,
      descriptionMappings,
    );
    const createdCount = await postCashTransactionBatch(
      tx,
      accountId,
      resolved.map((row) => ({
        type: row.type,
        amount: parsePositiveAmount(row.amount),
        occurredAt: row.occurredAt,
        description: row.description,
        categoryId: row.categoryId,
      })),
    );
    for (const m of descriptionMappings) {
      if (m.action === "map") {
        await upsertExactDescriptionRule(
          tx,
          userId,
          m.descriptionKey,
          m.ledgerType,
          m.categoryId,
        );
      }
    }
    await createImportBatch(tx, {
      userId,
      accountId,
      source,
      createdCount,
      skippedDuplicateCount: allSkipped.length,
      skippedTransferCount,
    });
    return {
      created: createdCount,
      createdCategories: applied.createdCategories,
    };
  });
}

export type CommitMappedImportResult =
  | {
      ok: true;
      created: number;
      createdCategories: number;
      skippedDuplicates: SkippedDuplicateRow[];
      skippedTransferCount: number;
    }
  | { ok: false; errors: ImportRowError[] };

/** Shared ledger/columns commit: partition, parse mappings, persist. */
export async function commitMappedCashImport(
  prisma: PrismaClient,
  input: {
    userId: number;
    accountId: number;
    draftsIn: CashLedgerImportDraft[];
    skippedTransferCount: number;
    source: "ledger_csv" | "columns_csv";
    categoryMappingsBody: unknown;
    descriptionMappingsBody: unknown;
  },
): Promise<CommitMappedImportResult> {
  const ownedCategories = await prisma.category.findMany({
    where: { userId: input.userId },
    select: { id: true, name: true, parentId: true, ledgerType: true },
  });
  const drafts = enrichLegacyCategoryPaths(input.draftsIn, ownedCategories);
  const fingerprints = await loadAccountImportFingerprints(
    prisma,
    input.accountId,
    { drafts },
  );
  const { toImport, skippedDuplicates } = partitionDraftsByExisting(
    drafts,
    fingerprints,
  );
  const used = collectUsedCategories(toImport);
  const mappingsResult = parseCategoryMappings(
    input.categoryMappingsBody,
    used,
  );
  if (!mappingsResult.ok) {
    return { ok: false, errors: mappingsResult.errors };
  }
  const usedDesc = collectUsedDescriptions(toImport);
  const descResult = parseDescriptionMappings(
    input.descriptionMappingsBody,
    usedDesc,
  );
  if (!descResult.ok) {
    return { ok: false, errors: descResult.errors };
  }
  await assertDescriptionMapCategories(
    prisma,
    input.userId,
    descResult.mappings,
  );
  const { created, createdCategories } = await persistMappedImport(
    prisma,
    input.userId,
    input.accountId,
    toImport,
    skippedDuplicates,
    input.skippedTransferCount,
    input.source,
    mappingsResult.mappings,
    descResult.mappings,
    ownedCategories,
    used,
  );
  return {
    ok: true,
    created,
    createdCategories,
    skippedDuplicates,
    skippedTransferCount: input.skippedTransferCount,
  };
}
