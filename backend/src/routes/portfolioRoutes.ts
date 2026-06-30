import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { ASSET_BUCKETS, getUserPortfolioPositions } from "../portfolio";
import { handleRouteError, parseIdParam } from "./httpSupport";

type PortfolioDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  getFxRatesPlnPerUnit: () => Promise<{ asOf: string; plnPerUnit: Record<string, number> }>;
};

export function createPortfolioRouter(deps: PortfolioDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid, getFxRatesPlnPerUnit } = deps;

  router.get("/api/portfolio/positions", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const filters: {
        accountId?: number;
        instrumentType?: string;
        assetBucket?: string;
      } = {};

      if (req.query.accountId != null && String(req.query.accountId).length > 0) {
        filters.accountId = parseIdParam(String(req.query.accountId), "accountId");
      }

      const instrumentType = req.query.instrumentType;
      if (instrumentType != null && String(instrumentType).trim()) {
        filters.instrumentType = String(instrumentType).trim();
      }

      const assetBucket = req.query.assetBucket;
      if (assetBucket != null && String(assetBucket).trim()) {
        const bucket = String(assetBucket).trim();
        if (!ASSET_BUCKETS.includes(bucket as (typeof ASSET_BUCKETS)[number])) {
          return res.status(400).json({ error: "Invalid assetBucket filter" });
        }
        filters.assetBucket = bucket;
      }

      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const positions = await getUserPortfolioPositions(prisma, uid(req), plnPerUnit, filters);
      res.json({ positions });
    } catch (e: unknown) {
      handleRouteError(res, e, "Portfolio fetch failed");
    }
  });

  return router;
}
