import { Router } from "express";
import { type CashTransaction, type PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  parseCashTxType,
  parsePositiveAmount,
  postCashTransaction,
  reverseCashTransaction,
  updateCashTransaction,
} from "../domain/cashLedger";
import { minorToDecimal, minorToMajor } from "../domain/money";
import {
  buildCashLedgerCsv,
  buildCategoryPathMap,
  cashLedgerExportFilename,
} from "../domain/cashLedgerCsv";
import { expectedCategoryLedgerType } from "../domain/categories";
import {
  cursorWhere,
  pageResultFromRows,
  parseListPageQuery,
} from "../domain/listPageQuery";
import {
  assertOwnedTagIds,
  loadTagIdsForTransactions,
  parseOptionalTagIds,
  setTransactionTags,
} from "../domain/tags";
import { findOwnedAccount, findOwnedAccountId } from "../domain/ownedAccount";
import {
  assertExportRowCap,
  assertMonthListCap,
  CSV_EXPORT_ROW_CAP,
  MONTH_LIST_CAP,
} from "../domain/rowCaps";
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

export function cashTransactionPayload(
  tx: CashTransaction,
  tagIds: number[] = [],
) {
  return {
    id: tx.id,
    accountId: tx.accountId,
    type: tx.type,
    amount: minorToMajor(tx.amount),
    occurredAt: tx.occurredAt.toISOString(),
    description: tx.description,
    categoryId: tx.categoryId,
    tagIds,
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
  const expected = expectedCategoryLedgerType(txType);
  if (category.ledgerType !== expected) {
    throw badRequest("category ledgerType must match transaction type");
  }
  return category.id;
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
            take: CSV_EXPORT_ROW_CAP + 1,
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
        assertExportRowCap(rows.length, "the ledger");
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

  router.get(
    "/api/accounts/:accountId/transactions",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        await findOwnedAccountId(prisma, uid(req), accountId);
        const page = parseListPageQuery(req.query);
        const where =
          page.mode === "month"
            ? {
                accountId,
                occurredAt: { gte: page.start, lt: page.end },
              }
            : {
                accountId,
                ...cursorWhere(page.beforeOccurredAt, page.beforeId),
              };
        const take =
          page.mode === "month" ? MONTH_LIST_CAP + 1 : page.limit + 1;
        const rows = await prisma.cashTransaction.findMany({
          where,
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          take,
        });
        if (page.mode === "month") {
          assertMonthListCap(rows.length, "transactions");
        }
        const sliced =
          page.mode === "month"
            ? { items: rows, nextCursor: null as string | null }
            : pageResultFromRows(rows, page.limit);
        const tagMap = await loadTagIdsForTransactions(
          prisma,
          sliced.items.map((r) => r.id),
        );
        res.json({
          items: sliced.items.map((row) =>
            cashTransactionPayload(row, tagMap.get(row.id) ?? []),
          ),
          nextCursor: sliced.nextCursor,
        });
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
        const userId = uid(req);
        await findOwnedAccountId(prisma, userId, accountId);

        const body = req.body ?? {};
        const type = parseCashTxType(body.type);
        const amount = parsePositiveAmount(body.amount);
        const occurredAt = parseOccurredAt(body.occurredAt);
        const description = parseOptionalDescription(body.description);
        const categoryId = await assertOwnedCategoryForTx(
          prisma,
          userId,
          parseOptionalCategoryId(body.categoryId),
          type,
        );
        const rawTagIds = parseOptionalTagIds(body.tagIds) ?? [];
        const tagIds = await assertOwnedTagIds(prisma, userId, rawTagIds);

        const created = await prisma.$transaction(async (tx) => {
          const row = await postCashTransaction(tx, {
            accountId,
            type,
            amount,
            occurredAt,
            description,
            categoryId,
          });
          await setTransactionTags(tx, row.id, tagIds);
          return row;
        });

        res.status(201).json(cashTransactionPayload(created, tagIds));
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
        const userId = uid(req);
        await findOwnedAccountId(prisma, userId, accountId);

        const existing = await prisma.cashTransaction.findFirst({
          where: { id, accountId },
        });
        if (!existing) throw notFound("Transaction not found");
        if (existing.transferId != null) {
          throw badRequest("edit or delete via /api/transfers");
        }

        const body = req.body ?? {};
        const hasField = [
          "type",
          "amount",
          "occurredAt",
          "description",
          "categoryId",
          "tagIds",
        ].some((key) => body[key] !== undefined);
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
          userId,
          categoryIdRaw,
          type,
        );

        const tagIdsProvided = body.tagIds !== undefined;
        const nextTagIds = tagIdsProvided
          ? await assertOwnedTagIds(
              prisma,
              userId,
              parseOptionalTagIds(body.tagIds) ?? [],
            )
          : null;

        const updated = await prisma.$transaction(async (tx) => {
          const row = await updateCashTransaction(tx, accountId, existing, {
            type,
            amount,
            occurredAt,
            description,
            categoryId,
          });
          if (nextTagIds != null) {
            await setTransactionTags(tx, row.id, nextTagIds);
          }
          return row;
        });

        const tagMap = await loadTagIdsForTransactions(prisma, [updated.id]);
        res.json(
          cashTransactionPayload(updated, tagMap.get(updated.id) ?? []),
        );
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
