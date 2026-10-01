import { Router } from "express";
import type { Account, Prisma, PrismaClient } from "@prisma/client";
import { Prisma as PrismaNS } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { parseAccountType } from "../domain/accountTypes";
import { decimalToMinor, minorToMajor, normalizeCurrencyCode, parseOpeningBalance } from "../domain/money";
import {
  badRequest,
  conflict,
  handleRouteError,
  notFound,
  parseIdParam,
  parseRequiredString,
} from "./httpSupport";

type AccountsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

function normalizeCurrency(value: unknown): string {
  return normalizeCurrencyCode(value, { defaultCode: "PLN" });
}

function parseOptionalDescription(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  if (text.length > 500) throw badRequest("description must be at most 500 characters");
  return text.length ? text : null;
}

function parseOpeningCashAsOf(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw badRequest("openingCashAsOf must be a valid date");
  return date;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof PrismaNS.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export function accountPayload(account: Account) {
  const cashBalance = minorToMajor(account.cashBalance);
  return {
    id: account.id,
    userId: account.userId,
    accountType: account.accountType,
    name: account.name,
    currency: account.currency,
    cashBalance,
    openingBalance: minorToMajor(account.openingBalance),
    openingCashAsOf: account.openingCashAsOf
      ? account.openingCashAsOf.toISOString()
      : null,
    description: account.description,
    totalBalance: cashBalance,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

async function findOwnedAccount(
  prisma: PrismaClient,
  userId: number,
  id: number,
): Promise<Account> {
  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) throw notFound("Account not found");
  return account;
}

export function createAccountsRouter(deps: AccountsDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/accounts", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accounts = await prisma.account.findMany({
        where: { userId: uid(req) },
        orderBy: { createdAt: "desc" },
      });
      res.json(accounts.map(accountPayload));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to list accounts");
    }
  });

  router.post("/api/accounts", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const body = req.body ?? {};
      const accountType = parseAccountType(body.accountType);

      const name = parseRequiredString(body.name, "name");
      if (name.length > 100) throw badRequest("name must be at most 100 characters");
      const currency = normalizeCurrency(body.currency);
      const openingBalance =
        body.openingBalance === undefined || body.openingBalance === null || body.openingBalance === ""
          ? 0
          : decimalToMinor(parseOpeningBalance(body.openingBalance));
      const openingCashAsOf = parseOpeningCashAsOf(body.openingCashAsOf);
      const description = parseOptionalDescription(body.description);

      const account = await prisma.account.create({
        data: {
          userId: uid(req),
          accountType,
          name,
          currency,
          openingBalance,
          cashBalance: openingBalance,
          openingCashAsOf: openingCashAsOf === undefined ? null : openingCashAsOf,
          description: description === undefined ? null : description,
        },
      });
      res.status(201).json(accountPayload(account));
    } catch (e: unknown) {
      if (isUniqueConstraintError(e)) {
        handleRouteError(res, badRequest("Account name already exists"), "Create account failed");
        return;
      }
      handleRouteError(res, e, "Create account failed");
    }
  });

  router.get("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const account = await findOwnedAccount(prisma, uid(req), id);
      res.json(accountPayload(account));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load account");
    }
  });

  router.patch("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const account = await findOwnedAccount(prisma, uid(req), id);

      const body = req.body ?? {};
      const data: Prisma.AccountUpdateInput = {};

      if (body.name !== undefined) {
        const name = parseRequiredString(body.name, "name");
        if (name.length > 100) throw badRequest("name must be at most 100 characters");
        data.name = name;
      }
      if (body.currency !== undefined) {
        const nextCurrency = normalizeCurrency(body.currency);
        if (nextCurrency !== account.currency) {
          const txCount = await prisma.cashTransaction.count({
            where: { accountId: id },
          });
          if (txCount > 0) {
            throw conflict("Cannot change currency while the account has transactions");
          }
        }
        data.currency = nextCurrency;
      }
      if (body.description !== undefined) {
        data.description = parseOptionalDescription(body.description) ?? null;
      }

      if (Object.keys(data).length === 0) {
        throw badRequest("No updatable fields provided");
      }

      const updated = await prisma.account.update({
        where: { id },
        data,
      });
      res.json(accountPayload(updated));
    } catch (e: unknown) {
      if (isUniqueConstraintError(e)) {
        handleRouteError(res, badRequest("Account name already exists"), "Update account failed");
        return;
      }
      handleRouteError(res, e, "Update account failed");
    }
  });

  router.delete("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      await findOwnedAccount(prisma, uid(req), id);
      await prisma.account.delete({ where: { id } });
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Delete account failed");
    }
  });

  return router;
}
