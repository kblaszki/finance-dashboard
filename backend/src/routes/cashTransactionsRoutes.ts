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
  cashLedgerExportFilename,
} from "../domain/cashLedgerCsv";
import {
  formatImportErrors,
  parseCashLedgerCsvImport,
  resolveImportCategoryIds,
} from "../domain/cashLedgerCsvImport";
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

async function assertOwnedCategoryId(
  prisma: PrismaClient,
  userId: number,
  categoryId: number | null,
): Promise<number | null> {
  if (categoryId === null) return null;
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });
  if (!category) throw notFound("Category not found");
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
        const account = await findOwnedAccount(prisma, uid(req), accountId);
        const rows = await prisma.cashTransaction.findMany({
          where: { accountId },
          orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
          include: { category: { select: { name: true } } },
        });
        const csv = buildCashLedgerCsv({
          currency: account.currency,
          rows: rows.map((row) => ({
            id: row.id,
            type: row.type,
            amount: minorToMajor(row.amount),
            occurredAt: row.occurredAt,
            description: row.description,
            categoryId: row.categoryId,
            categoryName: row.category?.name ?? null,
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
    "/api/accounts/:accountId/transactions/import",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const account = await findOwnedAccount(prisma, uid(req), accountId);
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
          where: { userId: uid(req) },
          select: { id: true, name: true },
        });
        const resolved = resolveImportCategoryIds(parsed.drafts, ownedCategories);
        if (!resolved.ok) {
          res.status(400).json({
            error: formatImportErrors(resolved.errors),
            details: resolved.errors,
          });
          return;
        }

        const created = await prisma.$transaction((tx) =>
          postCashTransactionBatch(
            tx,
            accountId,
            resolved.rows.map((row) => ({
              type: row.type,
              amount: parsePositiveAmount(row.amount),
              occurredAt: row.occurredAt,
              description: row.description,
              categoryId: row.categoryId,
            })),
          ),
        );

        res.status(201).json({ created });
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
        const categoryId = await assertOwnedCategoryId(
          prisma,
          uid(req),
          parseOptionalCategoryId(body.categoryId),
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
        const categoryId =
          body.categoryId !== undefined
            ? await assertOwnedCategoryId(
                prisma,
                uid(req),
                parseOptionalCategoryId(body.categoryId),
              )
            : existing.categoryId;

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
