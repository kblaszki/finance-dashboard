import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { revalueManualAccount } from "../manualAccountRevalue";
import { getLatestAccountTotalValue, getLatestAccountTotalValues, toNumber } from "../accountValuation";
import { computeAccountDetailStats } from "../accountStats";
import type { DbClient, TransactionDateFilter } from "./routeSupport";
import { parseDateBody, serializeAccount } from "./routeSupport";
import { handleRouteError, badRequest, parseIdParam, parseFiniteNumber, parsePositiveNumber, parseRequiredString } from "./httpSupport";

const VALID_ACCOUNT_TYPES = new Set(["BANK", "BROKERAGE", "MANUAL"]);

type AccountsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeCurrency: (value: unknown) => string;
  getFxRatesPlnPerUnit: () => Promise<{ asOf: string; plnPerUnit: Record<string, number> }>;
  backfillAccountValuations: (
    db: DbClient,
    accountId: number,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
  recalcTransactionBalances: (db: DbClient, accountId: number, fromDate?: Date) => Promise<void>;
  recomputeAccountValuationsFrom: (
    db: DbClient,
    accountId: number,
    fromDate: Date,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
  getAccountForUser: (db: DbClient, userId: number, accountId: number) => Promise<any>;
  transactionDateFilter: TransactionDateFilter;
  toNumber: (value: unknown) => number;
};

export function createAccountsRouter(deps: AccountsDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    getFxRatesPlnPerUnit,
    backfillAccountValuations,
    recalcTransactionBalances,
    recomputeAccountValuationsFrom,
    getAccountForUser,
    transactionDateFilter,
    toNumber,
  } = deps;

  router.get("/api/accounts", requireAuth, async (req: AuthedRequest, res) => {
    const rows = await prisma.account.findMany({
      where: { userId: uid(req) },
      orderBy: { name: "asc" },
    });
    const totals = await getLatestAccountTotalValues(
      prisma,
      rows.map((row) => row.id),
    );
    res.json(
      rows.map((row) =>
        serializeAccount(row, totals.get(row.id) ?? toNumber(row.cashBalance)),
      ),
    );
  });

  router.post("/api/accounts", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountType = parseRequiredString(req.body?.accountType, "accountType").toUpperCase();
      if (!VALID_ACCOUNT_TYPES.has(accountType)) {
        throw badRequest("Invalid accountType");
      }
      const name = parseRequiredString(req.body?.name, "name");
      const currency = normalizeCurrency(req.body?.currency ?? "PLN");
      const openingBalance = parseFiniteNumber(req.body?.openingBalance ?? 0, "openingBalance", {
        min: 0,
      });
      const description = req.body?.description != null ? String(req.body.description) : null;
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.account.create({
          data: {
            userId: uid(req),
            accountType,
            name,
            currency,
            openingBalance,
            cashBalance: openingBalance,
            description,
          },
        });
        await backfillAccountValuations(tx, created.id, plnPerUnit);
        return created;
      });
      res.status(201).json(serializeAccount(row, openingBalance));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create account");
    }
  });

  router.get("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const row = await getAccountForUser(prisma, uid(req), id);
      if (!row) return res.status(404).json({ error: "Account not found" });
      const totalBalance =
        (await getLatestAccountTotalValue(prisma, id)) ?? toNumber(row.cashBalance);
      res.json(serializeAccount(row, totalBalance));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load account");
    }
  });

  router.get("/api/accounts/:id/stats", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const row = await getAccountForUser(prisma, uid(req), id);
      if (!row) return res.status(404).json({ error: "Account not found" });
      const currency = normalizeCurrency(req.query.currency ?? row.currency);
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const stats = await computeAccountDetailStats(prisma, row, currency, plnPerUnit);
      res.json(stats);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load account stats");
    }
  });

  router.put("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const row = await getAccountForUser(prisma, uid(req), id);
      if (!row) return res.status(404).json({ error: "Account not found" });
      const data: { name?: string; description?: string | null } = {};
      if (req.body?.name != null) data.name = String(req.body.name).trim();
      if (req.body?.description !== undefined) {
        data.description = req.body.description != null ? String(req.body.description) : null;
      }
      const updated = await prisma.account.update({ where: { id }, data });
      const totalBalance =
        (await getLatestAccountTotalValue(prisma, id)) ?? toNumber(updated.cashBalance);
      res.json(serializeAccount(updated, totalBalance));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to update account");
    }
  });

  router.delete("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const row = await getAccountForUser(prisma, uid(req), id);
      if (!row) return res.status(404).json({ error: "Account not found" });
      await prisma.account.delete({ where: { id } });
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete account");
    }
  });

  router.get("/api/accounts/:id/valuations", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const row = await getAccountForUser(prisma, uid(req), id);
      if (!row) return res.status(404).json({ error: "Account not found" });
      const date = transactionDateFilter(req.query.from, req.query.to);
      const rows = await prisma.accountValuationDaily.findMany({
        where: { accountId: id, ...(date ? { valuationDate: date } : {}) },
        orderBy: { valuationDate: "asc" },
      });
      res.json(
        rows.map((r) => ({
          valuationDate: r.valuationDate.toISOString(),
          totalValue: toNumber(r.totalValue),
          cashValue: toNumber(r.cashValue),
          securitiesValue: toNumber(r.securitiesValue),
          currency: r.currency,
        })),
      );
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load account valuations");
    }
  });

  router.post("/api/accounts/:id/revalue", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const row = await getAccountForUser(prisma, uid(req), id);
      if (!row) return res.status(404).json({ error: "Account not found" });
      if (row.accountType !== "MANUAL") {
        throw badRequest("Revaluation is only supported for MANUAL accounts");
      }
      const value = parsePositiveNumber(req.body?.value, "value");
      const valuationDate = req.body?.valuationDate
        ? parseDateBody(req.body.valuationDate)
        : new Date();
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const updated = await revalueManualAccount(prisma, row, value, valuationDate, plnPerUnit, {
        recalcTransactionBalances,
        recomputeAccountValuationsFrom,
      });
      const totalBalance =
        (await getLatestAccountTotalValue(prisma, id)) ?? toNumber(updated.cashBalance);
      res.json(serializeAccount(updated, totalBalance));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to revalue account");
    }
  });

  return router;
}
