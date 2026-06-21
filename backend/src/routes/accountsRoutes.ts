import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import type { DbClient, TransactionDateFilter } from "./routeSupport";
import { handleRouteError, badRequest, parseFiniteNumber, parseRequiredString } from "./httpSupport";

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
  getAccountForUser: (db: DbClient, userId: number, accountId: number) => Promise<any>;
  transactionDateFilter: TransactionDateFilter;
  serializeAccount: (row: any) => unknown;
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
    getAccountForUser,
    transactionDateFilter,
    serializeAccount,
    toNumber,
  } = deps;

  router.get("/api/accounts", requireAuth, async (req: AuthedRequest, res) => {
    const rows = await prisma.account.findMany({
      where: { userId: uid(req) },
      orderBy: { name: "asc" },
    });
    res.json(rows.map(serializeAccount));
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
      res.status(201).json(serializeAccount(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create account");
    }
  });

  router.get("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const row = await getAccountForUser(prisma, uid(req), id);
    if (!row) return res.status(404).json({ error: "Account not found" });
    res.json(serializeAccount(row));
  });

  router.put("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const row = await getAccountForUser(prisma, uid(req), id);
    if (!row) return res.status(404).json({ error: "Account not found" });
    const data: { name?: string; description?: string | null } = {};
    if (req.body?.name != null) data.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) {
      data.description = req.body.description != null ? String(req.body.description) : null;
    }
    const updated = await prisma.account.update({ where: { id }, data });
    res.json(serializeAccount(updated));
  });

  router.delete("/api/accounts/:id", requireAuth, async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const row = await getAccountForUser(prisma, uid(req), id);
    if (!row) return res.status(404).json({ error: "Account not found" });
    await prisma.account.delete({ where: { id } });
    res.status(204).send();
  });

  router.get("/api/accounts/:id/valuations", requireAuth, async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
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
  });

  return router;
}
