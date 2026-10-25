import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  parsePositiveAmount,
  postCashTransactionBatch,
} from "../domain/cashLedger";
import {
  formatImportErrors,
  parseCashLedgerCsvImport,
  type CashLedgerImportDraft,
  type SkippedTransferRow,
} from "../domain/cashLedgerCsvImport";
import {
  applyCategoryMappings,
  collectUsedCategories,
  enrichLegacyCategoryPaths,
  parseCategoryMappings,
  resolveDraftsWithMappings,
  suggestCategoryMatches,
  type ImportCategoryMapping,
} from "../domain/cashLedgerImportCategories";
import {
  normalizeMappedRows,
  parseColumnMapping,
  parseDelimitedTable,
  suggestColumnMapping,
} from "../domain/csvColumnMap";
import { findMatchingPresetId } from "../domain/csvImportPresets";
import {
  createImportBatch,
  loadAccountImportFingerprints,
  partitionDraftsByExisting,
  type SkippedDuplicateRow,
} from "../domain/cashImportDedup";
import {
  applyDescriptionMappings,
  buildDescriptionSuggestions,
  collectUsedDescriptions,
  parseDescriptionMappings,
  upsertExactDescriptionRule,
  type DescriptionMapping,
} from "../domain/categoryDescriptionSuggest";
import { expectedCategoryLedgerType } from "../domain/categories";
import { findOwnedAccount } from "../domain/ownedAccount";
import {
  badRequest,
  handleRouteError,
  notFound,
  parseIdParam,
} from "./httpSupport";

type CashImportDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
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

async function buildCategoryImportPreview(
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

async function assertDescriptionMapCategories(
  prisma: PrismaClient,
  userId: number,
  mappings: DescriptionMapping[],
): Promise<void> {
  for (const m of mappings) {
    if (m.action !== "map") continue;
    await assertOwnedCategoryForTx(prisma, userId, m.categoryId, m.ledgerType);
  }
}

async function persistMappedImport(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
  toImport: CashLedgerImportDraft[],
  skippedDuplicates: SkippedDuplicateRow[],
  skippedTransferCount: number,
  source: "ledger_csv" | "columns_csv",
  categoryMappings: ImportCategoryMapping[],
  descriptionMappings: DescriptionMapping[],
  ownedCategories: Array<{
    id: number;
    name: string;
    parentId: number | null;
    ledgerType: string;
  }>,
  used: ReturnType<typeof collectUsedCategories>,
): Promise<{ created: number; createdCategories: number }> {
  return prisma.$transaction(async (tx) => {
    // Re-check fingerprints inside the write transaction (TOCTOU harden).
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

export function createCashImportRouter(deps: CashImportDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.post(
    "/api/accounts/:accountId/transactions/import/preview",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const userId = uid(req);
        const account = await findOwnedAccount(prisma, userId, accountId);
        const csv = req.body?.csv;
        if (typeof csv !== "string") {
          throw badRequest("csv string required");
        }

        const parsed = parseCashLedgerCsvImport(csv, account.currency);
        if (!parsed.ok) {
          const headerIssue = parsed.errors.some((err) =>
            /CSV header/i.test(err.message),
          );
          res.status(400).json({
            error: formatImportErrors(parsed.errors),
            details: parsed.errors,
            ...(headerIssue ? { code: "UNKNOWN_LEDGER_CSV_HEADER" } : {}),
          });
          return;
        }

        const preview = await buildCategoryImportPreview(
          prisma,
          userId,
          accountId,
          parsed.drafts,
          parsed.skippedTransfers,
        );
        res.status(200).json(preview);
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to preview import");
      }
    },
  );

  router.post(
    "/api/accounts/:accountId/transactions/import",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const userId = uid(req);
        const account = await findOwnedAccount(prisma, userId, accountId);
        const csv = req.body?.csv;
        if (typeof csv !== "string") {
          throw badRequest("csv string required");
        }

        const parsed = parseCashLedgerCsvImport(csv, account.currency);
        if (!parsed.ok) {
          res.status(400).json({
            error: formatImportErrors(parsed.errors),
            details: parsed.errors,
          });
          return;
        }

        const ownedCategories = await prisma.category.findMany({
          where: { userId },
          select: { id: true, name: true, parentId: true, ledgerType: true },
        });
        const drafts = enrichLegacyCategoryPaths(
          parsed.drafts,
          ownedCategories,
        );
        const fingerprints = await loadAccountImportFingerprints(
          prisma,
          accountId,
          { drafts },
        );
        const { toImport, skippedDuplicates } = partitionDraftsByExisting(
          drafts,
          fingerprints,
        );
        const used = collectUsedCategories(toImport);
        const mappingsResult = parseCategoryMappings(
          req.body?.categoryMappings,
          used,
        );
        if (!mappingsResult.ok) {
          res.status(400).json({
            error: formatImportErrors(mappingsResult.errors),
            details: mappingsResult.errors,
          });
          return;
        }
        const usedDesc = collectUsedDescriptions(toImport);
        const descResult = parseDescriptionMappings(
          req.body?.descriptionMappings,
          usedDesc,
        );
        if (!descResult.ok) {
          res.status(400).json({
            error: formatImportErrors(descResult.errors),
            details: descResult.errors,
          });
          return;
        }
        await assertDescriptionMapCategories(
          prisma,
          userId,
          descResult.mappings,
        );

        const { created, createdCategories } = await persistMappedImport(
          prisma,
          userId,
          accountId,
          toImport,
          skippedDuplicates,
          parsed.skippedTransfers.length,
          "ledger_csv",
          mappingsResult.mappings,
          descResult.mappings,
          ownedCategories,
          used,
        );

        res.status(201).json({
          created,
          createdCategories,
          skipped: parsed.skippedTransfers.length,
          skippedTransfers: parsed.skippedTransfers,
          duplicateCount: skippedDuplicates.length,
          skippedDuplicates,
        });
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to import transactions");
      }
    },
  );

  router.post(
    "/api/accounts/:accountId/transactions/import/columns/preview",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const userId = uid(req);
        await findOwnedAccount(prisma, userId, accountId);
        const csv = req.body?.csv;
        if (typeof csv !== "string") {
          throw badRequest("csv string required");
        }
        const table = parseDelimitedTable(csv);
        const sampleRows = table.rows.slice(0, 5);
        const presets = await prisma.csvImportPreset.findMany({
          where: { userId, accountId },
          select: { id: true, mappingJson: true },
          orderBy: { name: "asc" },
        });
        const matchingPresetId = findMatchingPresetId(
          presets,
          table.headers,
        );
        res.status(200).json({
          delimiter: table.delimiter === "\t" ? "\\t" : table.delimiter,
          headers: table.headers,
          sampleRows,
          suggestedMapping: suggestColumnMapping(table.headers),
          matchingPresetId,
        });
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to preview CSV columns");
      }
    },
  );

  router.post(
    "/api/accounts/:accountId/transactions/import/columns/apply",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const userId = uid(req);
        await findOwnedAccount(prisma, userId, accountId);
        const csv = req.body?.csv;
        if (typeof csv !== "string") {
          throw badRequest("csv string required");
        }
        const table = parseDelimitedTable(csv);
        const mapping = parseColumnMapping(req.body?.columnMapping, table.headers);
        const parsed = normalizeMappedRows(table, mapping);
        if (!parsed.ok) {
          res.status(400).json({
            error: formatImportErrors(parsed.errors),
            details: parsed.errors,
          });
          return;
        }
        const preview = await buildCategoryImportPreview(
          prisma,
          userId,
          accountId,
          parsed.drafts,
          parsed.skippedTransfers,
        );
        res.status(200).json(preview);
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to apply column mapping");
      }
    },
  );

  router.post(
    "/api/accounts/:accountId/transactions/import/columns/commit",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const userId = uid(req);
        await findOwnedAccount(prisma, userId, accountId);
        const csv = req.body?.csv;
        if (typeof csv !== "string") {
          throw badRequest("csv string required");
        }
        const table = parseDelimitedTable(csv);
        const mapping = parseColumnMapping(req.body?.columnMapping, table.headers);
        const parsed = normalizeMappedRows(table, mapping);
        if (!parsed.ok) {
          res.status(400).json({
            error: formatImportErrors(parsed.errors),
            details: parsed.errors,
          });
          return;
        }

        const ownedCategories = await prisma.category.findMany({
          where: { userId },
          select: { id: true, name: true, parentId: true, ledgerType: true },
        });
        const drafts = enrichLegacyCategoryPaths(
          parsed.drafts,
          ownedCategories,
        );
        const fingerprints = await loadAccountImportFingerprints(
          prisma,
          accountId,
          { drafts },
        );
        const { toImport, skippedDuplicates } = partitionDraftsByExisting(
          drafts,
          fingerprints,
        );
        const used = collectUsedCategories(toImport);
        const mappingsResult = parseCategoryMappings(
          req.body?.categoryMappings,
          used,
        );
        if (!mappingsResult.ok) {
          res.status(400).json({
            error: formatImportErrors(mappingsResult.errors),
            details: mappingsResult.errors,
          });
          return;
        }
        const usedDesc = collectUsedDescriptions(toImport);
        const descResult = parseDescriptionMappings(
          req.body?.descriptionMappings,
          usedDesc,
        );
        if (!descResult.ok) {
          res.status(400).json({
            error: formatImportErrors(descResult.errors),
            details: descResult.errors,
          });
          return;
        }
        await assertDescriptionMapCategories(
          prisma,
          userId,
          descResult.mappings,
        );

        const { created, createdCategories } = await persistMappedImport(
          prisma,
          userId,
          accountId,
          toImport,
          skippedDuplicates,
          parsed.skippedTransfers.length,
          "columns_csv",
          mappingsResult.mappings,
          descResult.mappings,
          ownedCategories,
          used,
        );

        res.status(201).json({
          created,
          createdCategories,
          skipped: parsed.skippedTransfers.length,
          skippedTransfers: parsed.skippedTransfers,
          duplicateCount: skippedDuplicates.length,
          skippedDuplicates,
        });
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to commit column-mapped import");
      }
    },
  );


  return router;
}
