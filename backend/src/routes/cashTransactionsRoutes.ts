import { Router } from "express";
import { type CashTransaction, type PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  parseCashTxType,
  parsePositiveAmount,
  postCashTransaction,
  postCashTransactionBatch,
  reverseCashTransaction,
  updateCashTransaction,
} from "../domain/cashLedger";
import { minorToDecimal, minorToMajor } from "../domain/money";
import {
  buildCashLedgerCsv,
  buildCategoryPathMap,
  cashLedgerExportFilename,
} from "../domain/cashLedgerCsv";
import {
  formatImportErrors,
  parseCashLedgerCsvImport,
} from "../domain/cashLedgerCsvImport";
import {
  applyCategoryMappings,
  collectUsedCategories,
  enrichLegacyCategoryPaths,
  parseCategoryMappings,
  resolveDraftsWithMappings,
  suggestCategoryMatches,
} from "../domain/cashLedgerImportCategories";
import {
  badRequest,
  handleRouteError,
  notFound,
  parseIdParam,
} from "./httpSupport";

type CashTxDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

function parseOptionalDescription(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text.length > 500) throw badRequest("description must be at most 500 characters");
  return text.length ? text : null;
}

function parseOccurredAt(value: unknown): Date {
  if (value === undefined || value === null || value === "") {
    return new Date();
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw badRequest("occurredAt must be a valid date");
  }
  return date;
}

export function cashTransactionPayload(tx: CashTransaction) {
  return {
    id: tx.id,
    accountId: tx.accountId,
    type: tx.type,
    amount: minorToMajor(tx.amount),
    occurredAt: tx.occurredAt.toISOString(),
    description: tx.description,
    categoryId: tx.categoryId,
    transferId: tx.transferId ?? null,
    createdAt: tx.createdAt.toISOString(),
  };
}

function parseOptionalCategoryId(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest("categoryId must be a valid id");
  }
  return n;
}

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
  if (category.ledgerType !== txType) {
    throw badRequest("category ledgerType must match transaction type");
  }
  return category.id;
}

async function findOwnedAccountId(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
): Promise<number> {
  const account = await findOwnedAccount(prisma, userId, accountId);
  return account.id;
}

async function findOwnedAccount(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
): Promise<{ id: number; currency: string }> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
    select: { id: true, currency: true },
  });
  if (!account) throw notFound("Account not found");
  return account;
}

export function createCashTransactionsRouter(deps: CashTxDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get(
    "/api/accounts/:accountId/transactions/export",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const userId = uid(req);
        const account = await findOwnedAccount(prisma, userId, accountId);
        const [rows, categories] = await Promise.all([
          prisma.cashTransaction.findMany({
            where: { accountId },
            orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              type: true,
              amount: true,
              occurredAt: true,
              description: true,
              categoryId: true,
              createdAt: true,
            },
          }),
          prisma.category.findMany({
            where: { userId },
            select: { id: true, name: true, parentId: true },
          }),
        ]);
        const pathById = buildCategoryPathMap(categories);
        const csv = buildCashLedgerCsv({
          currency: account.currency,
          rows: rows.map((row) => ({
            id: row.id,
            type: row.type,
            amount: minorToMajor(row.amount),
            occurredAt: row.occurredAt,
            description: row.description,
            categoryPath:
              row.categoryId == null
                ? null
                : (pathById.get(row.categoryId) ?? null),
            createdAt: row.createdAt,
          })),
        });
        const filename = cashLedgerExportFilename(accountId);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
        res.status(200).send(csv);
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to export transactions");
      }
    },
  );

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
        const used = collectUsedCategories(drafts);
        const categories = suggestCategoryMatches(used, ownedCategories);
        res.status(200).json({
          rowCount: drafts.length,
          categories,
          skipped: parsed.skippedTransfers.length,
          skippedTransfers: parsed.skippedTransfers,
        });
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
        const used = collectUsedCategories(drafts);
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

        const { created, createdCategories } = await prisma.$transaction(
          async (tx) => {
            const applied = await applyCategoryMappings(
              tx,
              userId,
              mappingsResult.mappings,
              used,
              ownedCategories,
            );
            const resolved = resolveDraftsWithMappings(
              drafts,
              applied.resolvedIds,
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
            return {
              created: createdCount,
              createdCategories: applied.createdCategories,
            };
          },
        );

        res.status(201).json({
          created,
          createdCategories,
          skipped: parsed.skippedTransfers.length,
          skippedTransfers: parsed.skippedTransfers,
        });
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to import transactions");
      }
    },
  );

  router.get(
    "/api/accounts/:accountId/transactions",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        await findOwnedAccountId(prisma, uid(req), accountId);
        const rows = await prisma.cashTransaction.findMany({
          where: { accountId },
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        });
        res.json(rows.map(cashTransactionPayload));
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to list transactions");
      }
    },
  );

  router.post(
    "/api/accounts/:accountId/transactions",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        await findOwnedAccountId(prisma, uid(req), accountId);

        const body = req.body ?? {};
        const type = parseCashTxType(body.type);
        const amount = parsePositiveAmount(body.amount);
        const occurredAt = parseOccurredAt(body.occurredAt);
        const description = parseOptionalDescription(body.description);
        const categoryId = await assertOwnedCategoryForTx(
          prisma,
          uid(req),
          parseOptionalCategoryId(body.categoryId),
          type,
        );

        const created = await prisma.$transaction((tx) =>
          postCashTransaction(tx, {
            accountId,
            type,
            amount,
            occurredAt,
            description,
            categoryId,
          }),
        );

        res.status(201).json(cashTransactionPayload(created));
      } catch (e: unknown) {
        handleRouteError(res, e, "Create transaction failed");
      }
    },
  );

  router.patch(
    "/api/accounts/:accountId/transactions/:id",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const id = parseIdParam(req.params.id);
        await findOwnedAccountId(prisma, uid(req), accountId);

        const existing = await prisma.cashTransaction.findFirst({
          where: { id, accountId },
        });
        if (!existing) throw notFound("Transaction not found");
        if (existing.transferId != null) {
          throw badRequest("edit or delete via /api/transfers");
        }

        const body = req.body ?? {};
        const hasField = ["type", "amount", "occurredAt", "description", "categoryId"].some(
          (key) => body[key] !== undefined,
        );
        if (!hasField) throw badRequest("No updatable fields provided");

        const type =
          body.type !== undefined ? parseCashTxType(body.type) : parseCashTxType(existing.type);
        const amount =
          body.amount !== undefined ? parsePositiveAmount(body.amount) : minorToDecimal(existing.amount);
        const occurredAt =
          body.occurredAt !== undefined ? parseOccurredAt(body.occurredAt) : existing.occurredAt;
        const description =
          body.description !== undefined
            ? parseOptionalDescription(body.description)
            : existing.description;
        const categoryIdRaw =
          body.categoryId !== undefined
            ? parseOptionalCategoryId(body.categoryId)
            : existing.categoryId;
        const categoryId = await assertOwnedCategoryForTx(
          prisma,
          uid(req),
          categoryIdRaw,
          type,
        );

        const updated = await prisma.$transaction((tx) =>
          updateCashTransaction(tx, accountId, existing, {
            type,
            amount,
            occurredAt,
            description,
            categoryId,
          }),
        );
        res.json(cashTransactionPayload(updated));
      } catch (e: unknown) {
        handleRouteError(res, e, "Update transaction failed");
      }
    },
  );

  router.delete(
    "/api/accounts/:accountId/transactions/:id",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const id = parseIdParam(req.params.id);
        await findOwnedAccountId(prisma, uid(req), accountId);

        const existing = await prisma.cashTransaction.findFirst({
          where: { id, accountId },
        });
        if (!existing) throw notFound("Transaction not found");
        if (existing.transferId != null) {
          throw badRequest("edit or delete via /api/transfers");
        }

        await prisma.$transaction((tx) =>
          reverseCashTransaction(tx, accountId, existing),
        );

        res.status(204).send();
      } catch (e: unknown) {
        handleRouteError(res, e, "Delete transaction failed");
      }
    },
  );

  return router;
}
