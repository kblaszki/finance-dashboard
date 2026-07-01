import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import type { TransactionType } from "../transactionBalance";
import { validateTransactionForAccount } from "../transactionBalance";
import {
  replaceTransactionSplits,
  resolveTransactionCategory,
  validateTransactionSplits,
  type SplitInput,
} from "../transactionSplits";
import { writeAuditLog } from "../auditLog";
import type { DbClient, TransactionDateFilter } from "./routeSupport";
import { badRequest, handleRouteError, notFound, parseFiniteNumber, parseIdParam, parsePositiveNumber } from "./httpSupport";

const TRANSACTION_DOMAIN_ERRORS = new Set(["Insufficient cash balance"]);

const transactionInclude = {
  splits: { include: { category: { select: { name: true } } } },
};

function transactionAuditSnapshot(row: {
  id: number;
  accountId: number;
  transactionType: string;
  amount: unknown;
  currency: string;
  category: string;
  categoryId?: number | null;
  date: Date;
  description: string | null;
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    transactionType: row.transactionType,
    amount: Number(row.amount),
    currency: row.currency,
    category: row.category,
    categoryId: row.categoryId ?? null,
    date: row.date.toISOString(),
    description: row.description,
  };
}

function parseSplitsBody(body: unknown): SplitInput[] | undefined {
  if (!Array.isArray(body)) return undefined;
  return body.map((row) => ({
    categoryId: Number((row as { categoryId?: unknown }).categoryId),
    amount: Number((row as { amount?: unknown }).amount),
  }));
}

type TransactionsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeCurrency: (value: unknown) => string;
  parseDateBody: (value: unknown) => Date;
  transactionDateFilter: TransactionDateFilter;
  isValidTransactionType: (value: string) => value is TransactionType;
  getAccountForUser: (
    db: DbClient,
    userId: number,
    accountId: number,
  ) => Promise<{
    id: number;
    userId: number;
    accountType: string;
    name: string;
    currency: string;
    cashBalance: unknown;
    openingBalance: unknown;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null>;
  recalcTransactionBalances: (db: DbClient, accountId: number, fromDate?: Date) => Promise<void>;
  recomputeAccountValuationsFrom: (
    db: DbClient,
    accountId: number,
    fromDate: Date,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
  getFxRatesPlnPerUnit: () => Promise<{ asOf: string; plnPerUnit: Record<string, number> }>;
  serializeTransaction: (row: {
    id: number;
    accountId: number;
    transactionType: string;
    amount: unknown;
    balanceAfter: unknown;
    currency: string;
    category: string;
    date: Date;
    description: string | null;
  }) => unknown;
};

export function createTransactionsRouter(deps: TransactionsDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    parseDateBody,
    transactionDateFilter,
    isValidTransactionType,
    getAccountForUser,
    recalcTransactionBalances,
    recomputeAccountValuationsFrom,
    getFxRatesPlnPerUnit,
    serializeTransaction,
  } = deps;

  router.get("/api/transactions", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId =
        req.query.accountId != null
          ? parseFiniteNumber(req.query.accountId, "accountId", { min: 1 })
          : undefined;
      const where: { account: { userId: number }; accountId?: number } = {
        account: { userId: uid(req) },
      };
      if (accountId) where.accountId = accountId;
      const date = transactionDateFilter(req.query.from, req.query.to);
      const rows = await prisma.transaction.findMany({
        where: { ...where, ...(date ? { date } : {}) },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        include: transactionInclude,
      });
      res.json(rows.map(serializeTransaction));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load transactions");
    }
  });

  router.post("/api/transactions", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId = parseFiniteNumber(req.body?.accountId, "accountId", { min: 1 });
      const transactionType = String(req.body?.transactionType ?? "").trim().toUpperCase();
      const amount = parsePositiveNumber(req.body?.amount, "amount");
      const currency = normalizeCurrency(req.body?.currency);
      const date = parseDateBody(req.body?.date);
      const description = req.body?.description != null ? String(req.body.description) : null;
      const userId = uid(req);
      const rawSplits = parseSplitsBody(req.body?.splits);
      const splits = await validateTransactionSplits(prisma, userId, amount, rawSplits);
      const categoryIdBody =
        req.body?.categoryId != null
          ? parseFiniteNumber(req.body.categoryId, "categoryId", { min: 1 })
          : null;
      const resolved = await resolveTransactionCategory(prisma, userId, {
        categoryId: categoryIdBody,
        category: req.body?.category,
        splits,
      });

      if (!isValidTransactionType(transactionType)) {
        return res.status(400).json({ error: "Invalid transactionType" });
      }
      const account = await getAccountForUser(prisma, uid(req), accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });
      const accountTypeError = validateTransactionForAccount(transactionType, account.accountType);
      if (accountTypeError) return res.status(400).json({ error: accountTypeError });
      if (currency !== account.currency) {
        return res.status(400).json({ error: "Transaction currency must match account currency" });
      }
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const row = await prisma.$transaction(async (tx) => {
        const freshAccount = await getAccountForUser(tx, uid(req), accountId);
        if (!freshAccount) throw notFound("Account not found");
        const created = await tx.transaction.create({
          data: {
            accountId,
            transactionType,
            amount,
            balanceAfter: 0,
            currency,
            category: resolved.category,
            categoryId: resolved.categoryId,
            date,
            description,
          },
        });
        await replaceTransactionSplits(tx, created.id, splits);
        await recalcTransactionBalances(tx, accountId, date);
        await recomputeAccountValuationsFrom(tx, accountId, date, plnPerUnit);
        return tx.transaction.findUniqueOrThrow({
          where: { id: created.id },
          include: transactionInclude,
        });
      });
      await writeAuditLog(
        prisma,
        userId,
        "transaction",
        row.id,
        "create",
        null,
        transactionAuditSnapshot(row),
      );
      res.status(201).json(serializeTransaction(row));
    } catch (e: unknown) {
      if (e instanceof Error && TRANSACTION_DOMAIN_ERRORS.has(e.message)) {
        handleRouteError(res, badRequest(e.message), "Failed to create transaction");
        return;
      }
      handleRouteError(res, e, "Failed to create transaction");
    }
  });

  router.put("/api/transactions/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const existing = await prisma.transaction.findFirst({
        where: { id, account: { userId: uid(req) } },
      });
      if (!existing) return res.status(404).json({ error: "Transaction not found" });

      const data: Record<string, unknown> = {};
      if (req.body?.transactionType != null) {
        const t = String(req.body.transactionType).trim().toUpperCase();
        if (!isValidTransactionType(t)) return res.status(400).json({ error: "Invalid transactionType" });
        data.transactionType = t;
      }
      if (req.body?.amount != null) data.amount = parsePositiveNumber(req.body.amount, "amount");
      if (req.body?.currency != null) data.currency = normalizeCurrency(req.body.currency);
      if (req.body?.category != null) data.category = String(req.body.category);
      if (req.body?.categoryId !== undefined) {
        data.categoryId =
          req.body.categoryId == null
            ? null
            : parseFiniteNumber(req.body.categoryId, "categoryId", { min: 1 });
      }
      if (req.body?.date != null) data.date = parseDateBody(req.body.date);
      if (req.body?.description !== undefined) {
        data.description = req.body.description != null ? String(req.body.description) : null;
      }
      const account = await getAccountForUser(prisma, uid(req), existing.accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });
      const nextType = (data.transactionType ?? existing.transactionType) as TransactionType;
      if (!isValidTransactionType(nextType)) {
        return res.status(400).json({ error: "Invalid transactionType" });
      }
      const accountTypeError = validateTransactionForAccount(nextType, account.accountType);
      if (accountTypeError) return res.status(400).json({ error: accountTypeError });
      const nextCurrency =
        data.currency != null ? String(data.currency) : existing.currency;
      if (nextCurrency !== account.currency) {
        return res.status(400).json({ error: "Transaction currency must match account currency" });
      }
      const nextAmount =
        data.amount != null ? Number(data.amount) : Number(existing.amount);
      const userId = uid(req);
      const rawSplits =
        req.body?.splits !== undefined ? parseSplitsBody(req.body.splits) : undefined;
      const splits =
        rawSplits !== undefined
          ? await validateTransactionSplits(prisma, userId, nextAmount, rawSplits)
          : undefined;
      if (splits !== undefined || req.body?.categoryId !== undefined || req.body?.category != null) {
        const resolved = await resolveTransactionCategory(prisma, userId, {
          categoryId:
            data.categoryId !== undefined
              ? (data.categoryId as number | null)
              : existing.categoryId,
          category: (data.category as string | undefined) ?? existing.category,
          splits: splits ?? null,
        });
        data.category = resolved.category;
        data.categoryId = resolved.categoryId;
      }
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.transaction.update({ where: { id }, data });
        if (splits !== undefined) {
          await replaceTransactionSplits(tx, id, splits);
        }
        const recalcFrom =
          row.date.getTime() < existing.date.getTime() ? row.date : existing.date;
        await recalcTransactionBalances(tx, existing.accountId, recalcFrom);
        await recomputeAccountValuationsFrom(tx, existing.accountId, recalcFrom, plnPerUnit);
        return tx.transaction.findUniqueOrThrow({ where: { id }, include: transactionInclude });
      });
      await writeAuditLog(
        prisma,
        uid(req),
        "transaction",
        id,
        "update",
        transactionAuditSnapshot(existing),
        transactionAuditSnapshot(updated),
      );
      res.json(serializeTransaction(updated));
    } catch (e: unknown) {
      if (e instanceof Error && TRANSACTION_DOMAIN_ERRORS.has(e.message)) {
        handleRouteError(res, badRequest(e.message), "Failed to update transaction");
        return;
      }
      handleRouteError(res, e, "Failed to update transaction");
    }
  });

  router.delete("/api/transactions/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const existing = await prisma.transaction.findFirst({
        where: { id, account: { userId: uid(req) } },
      });
      if (!existing) return res.status(404).json({ error: "Transaction not found" });
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      await prisma.$transaction(async (tx) => {
        await tx.transaction.delete({ where: { id } });
        await recalcTransactionBalances(tx, existing.accountId, existing.date);
        await recomputeAccountValuationsFrom(tx, existing.accountId, existing.date, plnPerUnit);
      });
      await writeAuditLog(
        prisma,
        uid(req),
        "transaction",
        id,
        "delete",
        transactionAuditSnapshot(existing),
        null,
      );
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete transaction");
    }
  });

  return router;
}
