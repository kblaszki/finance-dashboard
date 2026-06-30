import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import type { DbClient, TransactionDateFilter } from "./routeSupport";
import { badRequest, handleRouteError, parseIdParam, parsePositiveNumber, parseRequiredString } from "./httpSupport";
import { parseInstrumentType } from "../instrumentTypes";

type InstrumentsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeCurrency: (value: unknown) => string;
  parseDateBody: (value: unknown) => Date;
  getFxRatesPlnPerUnit: () => Promise<{ asOf: string; plnPerUnit: Record<string, number> }>;
  recomputeAccountsForInstrumentUser: (
    db: DbClient,
    userId: number,
    instrumentId: number,
    fromDate: Date,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
  transactionDateFilter: TransactionDateFilter;
  serializeInstrument: (row: {
    id: number;
    instrumentType: string;
    symbol: string;
    name: string | null;
    exchange: string | null;
    currency: string;
    source: string;
    createdAt: Date;
  }) => unknown;
  serializeInstrumentValuation: (row: {
    id: number;
    instrumentId: number;
    valuationDate: Date;
    price: unknown;
    currency: string;
    source: string;
  }) => unknown;
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
    recomputeAccountsForInstrumentUser,
    transactionDateFilter,
    serializeInstrument,
    serializeInstrumentValuation,
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
    res.json(rows.map(serializeInstrument));
  });

  router.post("/api/instruments", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const instrumentType = parseInstrumentType(req.body?.instrumentType);
      const symbol = parseRequiredString(req.body?.symbol, "symbol").toUpperCase();
      const name = req.body?.name != null ? String(req.body.name) : null;
      const exchange = req.body?.exchange != null ? String(req.body.exchange) : null;
      const currency = normalizeCurrency(req.body?.currency ?? "USD");
      const source = String(req.body?.source ?? "manual");
      const pitZgCountry =
        req.body?.pitZgCountry != null ? String(req.body.pitZgCountry).trim().toUpperCase() : "PL";
      const row = await prisma.instrument.create({
        data: { instrumentType, symbol, name, exchange, currency, source, pitZgCountry },
      });
      res.status(201).json(serializeInstrument(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create instrument");
    }
  });

  router.get("/api/instruments/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const row = await prisma.instrument.findUnique({ where: { id } });
      if (!row) return res.status(404).json({ error: "Instrument not found" });
      res.json(serializeInstrument(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load instrument");
    }
  });

  router.get("/api/instruments/:id/valuations", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id);
      const date = transactionDateFilter(req.query.from, req.query.to);
      const rows = await prisma.instrumentValuation.findMany({
        where: { instrumentId: id, ...(date ? { valuationDate: date } : {}) },
        orderBy: { valuationDate: "asc" },
      });
      res.json(rows.map(serializeInstrumentValuation));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load instrument valuations");
    }
  });

  router.post("/api/instruments/:id/valuations", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const instrumentId = parseIdParam(req.params.id);
      const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
      if (!instrument) return res.status(404).json({ error: "Instrument not found" });
      const valuationDate = parseDateBody(req.body?.valuationDate);
      const price = parsePositiveNumber(req.body?.price, "price");
      const currency = normalizeCurrency(req.body?.currency ?? instrument.currency);
      const source = String(req.body?.source ?? "manual");
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.instrumentValuation.create({
          data: { instrumentId, valuationDate, price, currency, source },
        });
        await recomputeAccountsForInstrumentUser(tx, uid(req), instrumentId, valuationDate, plnPerUnit);
        return created;
      });
      res.status(201).json(serializeInstrumentValuation(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to add valuation");
    }
  });

  return router;
}
