import { Router } from "express";
import type { CashTransaction, Prisma, PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  parseCashTxType,
  parsePositiveAmount,
  signedDelta,
} from "../domain/cashLedger";
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

function decimalToNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
}

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
    amount: decimalToNumber(tx.amount),
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
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
  if (!account) throw notFound("Account not found");
  return account.id;
}

export function createCashTransactionsRouter(deps: CashTxDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

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
        const delta = signedDelta(type, amount);
        const occurredAt = parseOccurredAt(body.occurredAt);
        const description = parseOptionalDescription(body.description);
        const categoryId = await assertOwnedCategoryId(
          prisma,
          uid(req),
          parseOptionalCategoryId(body.categoryId),
        );

        const created = await prisma.$transaction(async (tx) => {
          const row = await tx.cashTransaction.create({
            data: {
              accountId,
              type,
              amount,
              occurredAt,
              description,
              categoryId,
            },
          });
          await tx.account.update({
            where: { id: accountId },
            data: { cashBalance: { increment: delta } },
          });
          return row;
        });

        res.status(201).json(cashTransactionPayload(created));
      } catch (e: unknown) {
        handleRouteError(res, e, "Create transaction failed");
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

        const type = parseCashTxType(existing.type);
        const reverseDelta = signedDelta(type, existing.amount).negated();

        await prisma.$transaction(async (tx) => {
          await tx.account.update({
            where: { id: accountId },
            data: { cashBalance: { increment: reverseDelta } },
          });
          await tx.cashTransaction.delete({ where: { id } });
        });

        res.status(204).send();
      } catch (e: unknown) {
        handleRouteError(res, e, "Delete transaction failed");
      }
    },
  );

  return router;
}
