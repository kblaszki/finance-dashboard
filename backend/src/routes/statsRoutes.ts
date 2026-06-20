import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import type { TransactionDateFilter } from "./routeSupport";

type StatsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeCurrency: (value: unknown) => string;
  transactionDateFilter: TransactionDateFilter;
  toNumber: (value: unknown) => number;
  convertAmount: (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    plnPerUnit: Record<string, number>,
  ) => number;
  getFxRatesPlnPerUnit: () => Promise<{ asOf: string; plnPerUnit: Record<string, number> }>;
  computeNetWorth: (
    prisma: PrismaClient,
    userId: number,
    displayCurrency: string,
  ) => Promise<{
    total: number;
    currency: string;
    byAccountType: Record<string, number>;
    accounts: Array<{ id: number; name: string; accountType: string; value: number }>;
  }>;
};

export function createStatsRouter(deps: StatsDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    transactionDateFilter,
    toNumber,
    convertAmount,
    getFxRatesPlnPerUnit,
    computeNetWorth,
  } = deps;

  router.get("/api/stats/net-worth", requireAuth, async (req: AuthedRequest, res) => {
    const currency = normalizeCurrency(req.query.currency ?? "PLN");
    const data = await computeNetWorth(prisma, uid(req), currency);
    res.json(data);
  });

  router.get("/api/stats/cashflow", requireAuth, async (req: AuthedRequest, res) => {
    const date = transactionDateFilter(req.query.from, req.query.to);
    const currency = normalizeCurrency(req.query.currency ?? "PLN");
    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    const rows = await prisma.transaction.findMany({
      where: { account: { userId: uid(req) }, ...(date ? { date } : {}) },
    });
    let income = 0;
    let expense = 0;
    for (const t of rows) {
      const amount = convertAmount(toNumber(t.amount), t.currency, currency, plnPerUnit);
      if (t.transactionType === "INCOME" || t.transactionType === "TRANSFER_IN") income += amount;
      if (t.transactionType === "EXPENSE" || t.transactionType === "TRANSFER_OUT") expense += amount;
    }
    res.json({ income, expense, net: income - expense, currency });
  });

  router.get("/api/stats/expenses-by-category", requireAuth, async (req: AuthedRequest, res) => {
    const date = transactionDateFilter(req.query.from, req.query.to);
    const currency = normalizeCurrency(req.query.currency ?? "PLN");
    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    const rows = await prisma.transaction.findMany({
      where: {
        account: { userId: uid(req) },
        transactionType: { in: ["EXPENSE", "TRANSFER_OUT"] },
        ...(date ? { date } : {}),
      },
    });
    const map = new Map<string, number>();
    for (const t of rows) {
      const amount = convertAmount(toNumber(t.amount), t.currency, currency, plnPerUnit);
      map.set(t.category, (map.get(t.category) ?? 0) + amount);
    }
    res.json([...map.entries()].map(([category, amount]) => ({ category, amount })));
  });

  router.get("/api/stats/income-by-category", requireAuth, async (req: AuthedRequest, res) => {
    const date = transactionDateFilter(req.query.from, req.query.to);
    const currency = normalizeCurrency(req.query.currency ?? "PLN");
    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    const rows = await prisma.transaction.findMany({
      where: {
        account: { userId: uid(req) },
        transactionType: { in: ["INCOME", "TRANSFER_IN"] },
        ...(date ? { date } : {}),
      },
    });
    const map = new Map<string, number>();
    for (const t of rows) {
      const amount = convertAmount(toNumber(t.amount), t.currency, currency, plnPerUnit);
      map.set(t.category, (map.get(t.category) ?? 0) + amount);
    }
    res.json([...map.entries()].map(([category, amount]) => ({ category, amount })));
  });

  return router;
}
