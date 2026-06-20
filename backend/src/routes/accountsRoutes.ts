import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import type { DbClient, TransactionDateFilter } from "./routeSupport";

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
      const accountType = String(req.body?.accountType ?? "").trim().toUpperCase();
      const name = String(req.body?.name ?? "").trim();
      const currency = normalizeCurrency(req.body?.currency ?? "PLN");
      const openingBalance = Number(req.body?.openingBalance ?? 0);
      const description = req.body?.description != null ? String(req.body.description) : null;
      if (!name || !accountType) return res.status(400).json({ error: "name and accountType required" });
      const row = await prisma.account.create({
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
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      await backfillAccountValuations(prisma, row.id, plnPerUnit);
      res.status(201).json(serializeAccount(row));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create account";
      res.status(400).json({ error: msg });
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
