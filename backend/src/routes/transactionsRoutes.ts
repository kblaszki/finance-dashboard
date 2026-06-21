import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import type { TransactionType } from "../transactionBalance";
import type { DbClient, TransactionDateFilter } from "./routeSupport";
import { handleRouteError, notFound, parseFiniteNumber, parsePositiveNumber } from "./httpSupport";

type TransactionsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeCurrency: (value: unknown) => string;
  parseDateBody: (value: unknown) => Date;
  transactionDateFilter: TransactionDateFilter;
  isValidTransactionType: (value: string) => value is TransactionType;
  computeBalanceAfter: (
    previousBalance: number,
    transactionType: TransactionType,
    amount: number,
    allowNegative?: boolean,
  ) => number;
  toNumber: (value: unknown) => number;
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
    computeBalanceAfter,
    toNumber,
    getAccountForUser,
    recalcTransactionBalances,
    recomputeAccountValuationsFrom,
    getFxRatesPlnPerUnit,
    serializeTransaction,
  } = deps;

  router.get("/api/transactions", requireAuth, async (req: AuthedRequest, res) => {
    const accountId = req.query.accountId != null ? Number(req.query.accountId) : undefined;
    const where: { account: { userId: number }; accountId?: number } = {
      account: { userId: uid(req) },
    };
    if (accountId) where.accountId = accountId;
    const date = transactionDateFilter(req.query.from, req.query.to);
    const rows = await prisma.transaction.findMany({
      where: { ...where, ...(date ? { date } : {}) },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
    res.json(rows.map(serializeTransaction));
  });

  router.post("/api/transactions", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId = parseFiniteNumber(req.body?.accountId, "accountId", { min: 1 });
      const transactionType = String(req.body?.transactionType ?? "").trim().toUpperCase();
      const amount = parsePositiveNumber(req.body?.amount, "amount");
      const currency = normalizeCurrency(req.body?.currency);
      const category = String(req.body?.category ?? "Uncategorized").trim() || "Uncategorized";
      const date = parseDateBody(req.body?.date);
      const description = req.body?.description != null ? String(req.body.description) : null;

      if (!isValidTransactionType(transactionType)) {
        return res.status(400).json({ error: "Invalid transactionType" });
      }
      const account = await getAccountForUser(prisma, uid(req), accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const row = await prisma.$transaction(async (tx) => {
        const freshAccount = await getAccountForUser(tx, uid(req), accountId);
        if (!freshAccount) throw notFound("Account not found");
        const previous = toNumber(freshAccount.cashBalance);
        const balanceAfter = computeBalanceAfter(previous, transactionType, amount);
        const created = await tx.transaction.create({
          data: {
            accountId,
            transactionType,
            amount,
            balanceAfter,
            currency,
            category,
            date,
            description,
          },
        });
        await tx.account.update({
          where: { id: accountId },
          data: { cashBalance: balanceAfter },
        });
        await recomputeAccountValuationsFrom(tx, accountId, date, plnPerUnit);
        return created;
      });
      res.status(201).json(serializeTransaction(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create transaction");
    }
  });

  router.put("/api/transactions/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = Number(req.params.id);
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
      if (req.body?.date != null) data.date = parseDateBody(req.body.date);
      if (req.body?.description !== undefined) {
        data.description = req.body.description != null ? String(req.body.description) : null;
      }
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.transaction.update({ where: { id }, data });
        const recalcFrom =
          row.date.getTime() < existing.date.getTime() ? row.date : existing.date;
        await recalcTransactionBalances(tx, existing.accountId, recalcFrom);
        await recomputeAccountValuationsFrom(tx, existing.accountId, recalcFrom, plnPerUnit);
        return row;
      });
      res.json(serializeTransaction(updated));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to update transaction");
    }
  });

  router.delete("/api/transactions/:id", requireAuth, async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
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
    res.status(204).send();
  });

  return router;
}
