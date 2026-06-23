import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { importBrokerTrades } from "../import/importTrades";
import type { BrokerId } from "../import/types";
import { badRequest, handleRouteError, notFound } from "./httpSupport";

type ImportDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  getFxRatesPlnPerUnit: () => Promise<{ asOf: string; plnPerUnit: Record<string, number> }>;
};

const BROKERS = new Set<BrokerId>(["xtb"]);

function parseBroker(value: unknown): BrokerId {
  const broker = String(value ?? "xtb").trim().toLowerCase();
  if (!BROKERS.has(broker as BrokerId)) {
    throw badRequest(`Unsupported broker: ${broker}`);
  }
  return broker as BrokerId;
}

export function createImportRouter(deps: ImportDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid, getFxRatesPlnPerUnit } = deps;

  router.post("/api/import/broker-trades", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId = Number(req.query.accountId ?? req.body?.accountId);
      if (!Number.isFinite(accountId) || accountId < 1) {
        return res.status(400).json({ error: "accountId is required" });
      }
      const dryRun =
        req.query.dryRun === "true" || req.query.dryRun === "1" || req.body?.dryRun === true;
      const broker = parseBroker(req.query.broker ?? req.body?.broker);
      const csvText = String(req.body?.csv ?? "").trim();
      if (!csvText) {
        return res.status(400).json({ error: "csv body field is required" });
      }
      const filename = req.body?.filename != null ? String(req.body.filename) : undefined;
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const result = await importBrokerTrades(prisma, {
        accountId,
        userId: uid(req),
        broker,
        csvText,
        filename,
        dryRun,
        plnPerUnit,
      });
      res.json(result);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "Account not found") {
        handleRouteError(res, notFound(e.message), "Import failed");
        return;
      }
      if (e instanceof Error && e.message.includes("only supported for brokerage")) {
        handleRouteError(res, badRequest(e.message), "Import failed");
        return;
      }
      handleRouteError(res, e, "Import failed");
    }
  });

  return router;
}
