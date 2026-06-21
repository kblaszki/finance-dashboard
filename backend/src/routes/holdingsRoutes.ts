import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { recomputeQuantityAfterChain } from "../holdingLot";
import type { DbClient, TransactionDateFilter } from "./routeSupport";
import { handleRouteError, badRequest, parsePositiveNumber } from "./httpSupport";

type HoldingsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeCurrency: (value: unknown) => string;
  parseDateBody: (value: unknown) => Date;
  isValidLotSide: (value: string) => boolean;
  resolveLotPrice: (input: {
    quantity: number;
    totalPrice?: number | null;
    pricePerUnit?: number | null;
  }) => { totalPrice: number; pricePerUnit: number };
  getFxRatesPlnPerUnit: () => Promise<{ asOf: string; plnPerUnit: Record<string, number> }>;
  getAccountForUser: (db: DbClient, userId: number, accountId: number) => Promise<any>;
  getAccountHoldings: (
    db: DbClient,
    accountId: number,
    accountCurrency: string,
    plnPerUnit: Record<string, number>,
  ) => Promise<any>;
  getHoldingForUser: (db: DbClient, userId: number, holdingId: number) => Promise<any>;
  buildHoldingSummary: (
    db: DbClient,
    holding: any,
    accountCurrency: string,
    plnPerUnit: Record<string, number>,
  ) => Promise<any>;
  findOrCreateHolding: (db: DbClient, accountId: number, instrumentId: number) => Promise<any>;
  recalcLotQuantityChain: (db: DbClient, holdingId: number) => Promise<void>;
  syncHoldingQuantity: (db: DbClient, holdingId: number) => Promise<number>;
  syncBrokerageCashBalance: (db: DbClient, accountId: number) => Promise<number>;
  recomputeAccountValuationsFrom: (
    db: DbClient,
    accountId: number,
    fromDate: Date,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
  serializeHoldingSummary: (summary: any) => unknown;
  serializeHoldingLot: (row: any) => unknown;
  transactionDateFilter: TransactionDateFilter;
  toNumber: (value: unknown) => number;
};

export function createHoldingsRouter(deps: HoldingsDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    parseDateBody,
    isValidLotSide,
    resolveLotPrice,
    getFxRatesPlnPerUnit,
    getAccountForUser,
    getAccountHoldings,
    getHoldingForUser,
    buildHoldingSummary,
    findOrCreateHolding,
    recalcLotQuantityChain,
    syncHoldingQuantity,
    syncBrokerageCashBalance,
    recomputeAccountValuationsFrom,
    serializeHoldingSummary,
    serializeHoldingLot,
    transactionDateFilter,
    toNumber,
  } = deps;

  router.get("/api/accounts/:accountId/holdings", requireAuth, async (req: AuthedRequest, res) => {
    const accountId = Number(req.params.accountId);
    const account = await getAccountForUser(prisma, uid(req), accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });
    if (account.accountType !== "BROKERAGE") {
      return res.json({ open: [], closed: [] });
    }
    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    const holdings = await getAccountHoldings(prisma, accountId, account.currency, plnPerUnit);
    res.json(holdings);
  });

  router.post("/api/accounts/:accountId/holdings", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId = Number(req.params.accountId);
      const account = await getAccountForUser(prisma, uid(req), accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });
      if (account.accountType !== "BROKERAGE") {
        return res.status(400).json({ error: "Holdings are only for brokerage accounts" });
      }

      const instrumentId = Number(req.body?.instrumentId);
      const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
      if (!instrument) return res.status(404).json({ error: "Instrument not found" });

      const holding = await findOrCreateHolding(prisma, accountId, instrumentId);
      const row = await prisma.holding.findUnique({
        where: { id: holding.id },
        include: {
          instrument: true,
          lots: { orderBy: [{ tradeDate: "asc" }, { id: "asc" }] },
        },
      });
      if (!row) return res.status(404).json({ error: "Holding not found" });

      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const summary = await buildHoldingSummary(prisma, row, account.currency, plnPerUnit);
      res.status(201).json(serializeHoldingSummary(summary));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create holding");
    }
  });

  router.get("/api/holdings/:holdingId", requireAuth, async (req: AuthedRequest, res) => {
    const holdingId = Number(req.params.holdingId);
    const holding = await getHoldingForUser(prisma, uid(req), holdingId);
    if (!holding) return res.status(404).json({ error: "Holding not found" });

    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    const summary = await buildHoldingSummary(
      prisma,
      holding,
      holding.account.currency,
      plnPerUnit,
    );
    res.json(serializeHoldingSummary(summary));
  });

  router.get("/api/holdings/:holdingId/lots", requireAuth, async (req: AuthedRequest, res) => {
    const holdingId = Number(req.params.holdingId);
    const holding = await getHoldingForUser(prisma, uid(req), holdingId);
    if (!holding) return res.status(404).json({ error: "Holding not found" });

    const rows = await prisma.holdingLot.findMany({
      where: { holdingId },
      include: {
        holding: { include: { instrument: true } },
      },
      orderBy: [{ tradeDate: "desc" }, { id: "desc" }],
    });
    res.json(rows.map(serializeHoldingLot));
  });

  router.post("/api/holdings/:holdingId/lots", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const holdingId = Number(req.params.holdingId);
      const holding = await getHoldingForUser(prisma, uid(req), holdingId);
      if (!holding) return res.status(404).json({ error: "Holding not found" });

      const account = holding.account;
      const side = String(req.body?.side ?? "").trim().toUpperCase();
      const quantity = parsePositiveNumber(req.body?.quantity, "quantity");
      const currency = normalizeCurrency(req.body?.currency ?? account.currency);
      const tradeDate = parseDateBody(req.body?.tradeDate);

      if (!isValidLotSide(side)) return res.status(400).json({ error: "Invalid side" });

      const prices = resolveLotPrice({
        quantity,
        totalPrice: req.body?.totalPrice,
        pricePerUnit: req.body?.pricePerUnit,
      });
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const row = await prisma.$transaction(async (tx) => {
        const existingLots = await tx.holdingLot.findMany({
          where: { holdingId },
          orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
        });
        recomputeQuantityAfterChain([
          ...existingLots.map((lot) => ({
            id: lot.id,
            side: lot.side,
            quantity: toNumber(lot.quantity),
            tradeDate: lot.tradeDate,
          })),
          { id: -1, side, quantity, tradeDate },
        ]);

        const created = await tx.holdingLot.create({
          data: {
            holdingId,
            side,
            quantity,
            quantityAfter: 0,
            totalPrice: prices.totalPrice,
            pricePerUnit: prices.pricePerUnit,
            currency,
            tradeDate,
          },
          include: {
            holding: { include: { instrument: true } },
          },
        });

        await recalcLotQuantityChain(tx, holdingId);
        await syncHoldingQuantity(tx, holdingId);
        await syncBrokerageCashBalance(tx, account.id);
        await recomputeAccountValuationsFrom(tx, account.id, tradeDate, plnPerUnit);

        return tx.holdingLot.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            holding: { include: { instrument: true } },
          },
        });
      });
      res.status(201).json(serializeHoldingLot(row));
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        (e.message === "Cannot sell more than current position" ||
          e.message === "Quantity must be a positive number")
      ) {
        handleRouteError(res, badRequest(e.message), "Failed to create holding lot");
        return;
      }
      handleRouteError(res, e, "Failed to create holding lot");
    }
  });

  router.delete("/api/holding-lots/:id", requireAuth, async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.holdingLot.findFirst({
      where: { id, holding: { account: { userId: uid(req) } } },
      include: { holding: true },
    });
    if (!existing) return res.status(404).json({ error: "Holding lot not found" });

    const accountId = existing.holding.accountId;
    const holdingId = existing.holdingId;
    const tradeDate = existing.tradeDate;

    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    await prisma.$transaction(async (tx) => {
      await tx.holdingLot.delete({ where: { id } });
      await recalcLotQuantityChain(tx, holdingId);
      await syncHoldingQuantity(tx, holdingId);
      await syncBrokerageCashBalance(tx, accountId);
      await recomputeAccountValuationsFrom(tx, accountId, tradeDate, plnPerUnit);
    });
    res.status(204).send();
  });

  router.get(
    "/api/accounts/:accountId/holdings/:instrumentId/valuations",
    requireAuth,
    async (req: AuthedRequest, res) => {
      const accountId = Number(req.params.accountId);
      const instrumentId = Number(req.params.instrumentId);
      const account = await getAccountForUser(prisma, uid(req), accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });
      const date = transactionDateFilter(req.query.from, req.query.to);
      const rows = await prisma.holdingValuationDaily.findMany({
        where: {
          accountId,
          instrumentId,
          ...(date ? { valuationDate: date } : {}),
        },
        orderBy: { valuationDate: "asc" },
      });
      res.json(
        rows.map((r) => ({
          valuationDate: r.valuationDate.toISOString(),
          quantity: toNumber(r.quantity),
          marketValue: toNumber(r.marketValue),
          currency: r.currency,
        })),
      );
    },
  );

  return router;
}
