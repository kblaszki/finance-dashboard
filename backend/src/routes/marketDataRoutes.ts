import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { getMarketDataStatus, syncMarketPrices } from "../marketDataSync";
import { handleRouteError } from "./httpSupport";

type MarketDataDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>;
};

export function createMarketDataRouter(deps: MarketDataDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid, getFxRatesPlnPerUnit } = deps;

  router.get("/api/market-data/status", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const status = await getMarketDataStatus(prisma, uid(req));
      res.json(status);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load market data status");
    }
  });

  router.post("/api/market-data/sync", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const backfillDays =
        req.body?.backfillDays != null ? Number(req.body.backfillDays) : undefined;
      const result = await syncMarketPrices(prisma, getFxRatesPlnPerUnit, {
        userId: uid(req),
        backfillDays: Number.isFinite(backfillDays) ? backfillDays : undefined,
        delayMs: 0,
      });
      res.json(result);
    } catch (e: unknown) {
      handleRouteError(res, e, "Market data sync failed");
    }
  });

  return router;
}
