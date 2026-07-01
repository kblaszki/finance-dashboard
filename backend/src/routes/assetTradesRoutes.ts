import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { isHoldingsAccountType } from "../accountTypes";
import { createUserAssetTradeForAccount, fetchUserAssetTrades } from "../assetTrades";
import { writeAuditLog } from "../auditLog";
import { scheduleMarketSyncAfterBuy } from "../marketDataTrigger";
import type { DbClient, TransactionDateFilter } from "./routeSupport";
import {
  badRequest,
  handleRouteError,
  parseFiniteNumber,
  parseIdParam,
  parsePositiveNumber,
} from "./httpSupport";

type AssetTradesDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  normalizeCurrency: (value: unknown) => string;
  parseDateBody: (value: unknown) => Date;
  isValidLotSide: (value: string) => boolean;
  transactionDateFilter: TransactionDateFilter;
  getAccountForUser: (db: DbClient, userId: number, accountId: number) => Promise<any>;
  resolveLotPrice: (input: {
    quantity: number;
    totalPrice?: number | null;
    pricePerUnit?: number | null;
  }) => { totalPrice: number; pricePerUnit: number };
  getFxRatesPlnPerUnit: () => Promise<{ asOf: string; plnPerUnit: Record<string, number> }>;
  recomputeAccountValuationsFrom: (
    db: DbClient,
    accountId: number,
    fromDate: Date,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
  serializeHoldingLot: (row: any) => unknown;
  toNumber: (value: unknown) => number;
};

export function createAssetTradesRouter(deps: AssetTradesDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    normalizeCurrency,
    parseDateBody,
    isValidLotSide,
    transactionDateFilter,
    getAccountForUser,
    resolveLotPrice,
    getFxRatesPlnPerUnit,
    recomputeAccountValuationsFrom,
    serializeHoldingLot,
    toNumber,
  } = deps;

  const tradeDeps = {
    resolveLotPrice,
    getFxRatesPlnPerUnit,
    recomputeAccountValuationsFrom,
    toNumber,
  };

  router.get("/api/asset-trades", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const filters: {
        accountId?: number;
        instrumentId?: number;
        from?: Date;
        to?: Date;
      } = {};

      if (req.query.accountId != null && String(req.query.accountId).length > 0) {
        filters.accountId = parseIdParam(String(req.query.accountId), "accountId");
      }
      if (req.query.instrumentId != null && String(req.query.instrumentId).length > 0) {
        filters.instrumentId = parseIdParam(String(req.query.instrumentId), "instrumentId");
      }

      const date = transactionDateFilter(req.query.from, req.query.to);
      if (date?.gte) filters.from = date.gte;
      if (date?.lte) filters.to = date.lte;

      const rows = await fetchUserAssetTrades(prisma, uid(req), filters);
      res.json(rows.map(serializeHoldingLot));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load asset trades");
    }
  });

  router.post("/api/asset-trades", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId = parseFiniteNumber(req.body?.accountId, "accountId", { min: 1 });
      const instrumentId = parseFiniteNumber(req.body?.instrumentId, "instrumentId", { min: 1 });
      const side = String(req.body?.side ?? "").trim().toUpperCase();
      const quantity = parsePositiveNumber(req.body?.quantity, "quantity");
      const tradeDate = parseDateBody(req.body?.tradeDate);

      if (!isValidLotSide(side)) return res.status(400).json({ error: "Invalid side" });

      const account = await getAccountForUser(prisma, uid(req), accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });
      if (!isHoldingsAccountType(account.accountType)) {
        return res.status(400).json({ error: "Asset trades require a holdings account (brokerage, crypto, or precious metal)" });
      }

      const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
      if (!instrument) return res.status(404).json({ error: "Instrument not found" });

      const currency = normalizeCurrency(req.body?.currency ?? instrument.currency);
      const commission =
        req.body?.commission != null
          ? parseFiniteNumber(req.body.commission, "commission", { min: 0 })
          : 0;

      const row = await createUserAssetTradeForAccount(
        prisma,
        { id: account.id, currency: account.currency },
        {
          accountId: account.id,
          instrumentId,
          side,
          quantity,
          currency,
          tradeDate,
          totalPrice: req.body?.totalPrice,
          pricePerUnit: req.body?.pricePerUnit,
          commission,
        },
        tradeDeps,
      );
      if (side === "BUY") {
        scheduleMarketSyncAfterBuy(prisma, getFxRatesPlnPerUnit, {
          userId: uid(req),
          instrumentType: instrument.instrumentType,
        });
      }
      await writeAuditLog(prisma, uid(req), "asset_trade", row.id, "create", null, {
        id: row.id,
        accountId,
        instrumentId,
        side,
        quantity,
        currency,
        tradeDate: tradeDate.toISOString(),
      });
      res.status(201).json(serializeHoldingLot(row));
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        (e.message === "Cannot sell more than current position" ||
          e.message === "Quantity must be a positive number")
      ) {
        handleRouteError(res, badRequest(e.message), "Failed to create asset trade");
        return;
      }
      handleRouteError(res, e, "Failed to create asset trade");
    }
  });

  return router;
}
