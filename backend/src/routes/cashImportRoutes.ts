import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  formatImportErrors,
  parseCashLedgerCsvImport,
} from "../domain/cashLedgerCsvImport";
import {
  buildCategoryImportPreview,
  commitMappedCashImport,
} from "../domain/cashLedgerImportService";
import {
  normalizeMappedRows,
  parseColumnMapping,
  parseDelimitedTable,
  suggestColumnMapping,
} from "../domain/csvColumnMap";
import { findMatchingPresetId } from "../domain/csvImportPresets";
import { findOwnedAccount } from "../domain/ownedAccount";
import {
  badRequest,
  handleRouteError,
  parseIdParam,
} from "./httpSupport";

type CashImportDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

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
          const headerIssue = parsed.errors.some(
            (e) => e.code === "UNKNOWN_LEDGER_CSV_HEADER",
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

        const result = await commitMappedCashImport(prisma, {
          userId,
          accountId,
          draftsIn: parsed.drafts,
          skippedTransferCount: parsed.skippedTransfers.length,
          source: "ledger_csv",
          categoryMappingsBody: req.body?.categoryMappings,
          descriptionMappingsBody: req.body?.descriptionMappings,
        });
        if (!result.ok) {
          res.status(400).json({
            error: formatImportErrors(result.errors),
            details: result.errors,
          });
          return;
        }

        res.status(201).json({
          created: result.created,
          createdCategories: result.createdCategories,
          skipped: parsed.skippedTransfers.length,
          skippedTransfers: parsed.skippedTransfers,
          duplicateCount: result.skippedDuplicates.length,
          skippedDuplicates: result.skippedDuplicates,
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

        const result = await commitMappedCashImport(prisma, {
          userId,
          accountId,
          draftsIn: parsed.drafts,
          skippedTransferCount: parsed.skippedTransfers.length,
          source: "columns_csv",
          categoryMappingsBody: req.body?.categoryMappings,
          descriptionMappingsBody: req.body?.descriptionMappings,
        });
        if (!result.ok) {
          res.status(400).json({
            error: formatImportErrors(result.errors),
            details: result.errors,
          });
          return;
        }

        res.status(201).json({
          created: result.created,
          createdCategories: result.createdCategories,
          skipped: parsed.skippedTransfers.length,
          skippedTransfers: parsed.skippedTransfers,
          duplicateCount: result.skippedDuplicates.length,
          skippedDuplicates: result.skippedDuplicates,
        });
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to commit column-mapped import");
      }
    },
  );

  return router;
}
