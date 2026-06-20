import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import type { DbClient, TransactionDateFilter } from "./routeSupport";

type InstrumentsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeCurrency: (value: unknown) => string;
  parseDateBody: (value: unknown) => Date;
  getFxRatesPlnPerUnit: () => Promise<{ asOf: string; plnPerUnit: Record<string, number> }>;
  getAccountForUser: (db: DbClient, userId: number, accountId: number) => Promise<any>;
  recomputeAccountValuationsFrom: (
    db: DbClient,
    accountId: number,
    fromDate: Date,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
  transactionDateFilter: TransactionDateFilter;
  toNumber: (value: unknown) => number;
};

export function createInstrumentsRouter(deps: InstrumentsDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    parseDateBody,
    getFxRatesPlnPerUnit,
    getAccountForUser,
    recomputeAccountValuationsFrom,
    transactionDateFilter,
    toNumber,
  } = deps;

  router.get("/api/instruments", requireAuth, async (req: AuthedRequest, res) => {
    const q = String(req.query.q ?? "").trim();
    const rows = await prisma.instrument.findMany({
      ...(q
        ? {
            where: {
              OR: [{ symbol: { contains: q } }, { name: { contains: q } }],
            },
          }
        : {}),
      orderBy: { symbol: "asc" },
      take: 50,
    });
    res.json(rows);
  });

  router.post("/api/instruments", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const instrumentType = String(req.body?.instrumentType ?? "STOCK").trim().toUpperCase();
      const symbol = String(req.body?.symbol ?? "").trim().toUpperCase();
      const name = req.body?.name != null ? String(req.body.name) : null;
      const exchange = req.body?.exchange != null ? String(req.body.exchange) : null;
      const currency = normalizeCurrency(req.body?.currency ?? "USD");
      const source = String(req.body?.source ?? "manual");
      if (!symbol) return res.status(400).json({ error: "symbol required" });
      const row = await prisma.instrument.create({
        data: { instrumentType, symbol, name, exchange, currency, source },
      });
      res.status(201).json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create instrument";
      res.status(400).json({ error: msg });
    }
  });

  router.get("/api/instruments/:id/valuations", requireAuth, async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const date = transactionDateFilter(req.query.from, req.query.to);
    const rows = await prisma.instrumentValuation.findMany({
      where: { instrumentId: id, ...(date ? { valuationDate: date } : {}) },
      orderBy: { valuationDate: "asc" },
    });
    res.json(
      rows.map((r) => ({
        valuationDate: r.valuationDate.toISOString(),
        price: toNumber(r.price),
        currency: r.currency,
        source: r.source,
      })),
    );
  });

  router.post("/api/instruments/:id/valuations", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const instrumentId = Number(req.params.id);
      const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
      if (!instrument) return res.status(404).json({ error: "Instrument not found" });
      const valuationDate = parseDateBody(req.body?.valuationDate);
      const price = Number(req.body?.price);
      const currency = normalizeCurrency(req.body?.currency ?? instrument.currency);
      const source = String(req.body?.source ?? "manual");
      const row = await prisma.instrumentValuation.create({
        data: { instrumentId, valuationDate, price, currency, source },
      });
      const accounts = await prisma.holding.findMany({
        where: { instrumentId },
        select: { accountId: true },
        distinct: ["accountId"],
      });
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      for (const { accountId } of accounts) {
        const account = await getAccountForUser(prisma, uid(req), accountId);
        if (account) {
          await recomputeAccountValuationsFrom(prisma, accountId, valuationDate, plnPerUnit);
        }
      }
      res.status(201).json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add valuation";
      res.status(400).json({ error: msg });
    }
  });

  return router;
}
