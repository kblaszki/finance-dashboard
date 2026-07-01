import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createAssetValuation,
  deleteAssetValuation,
  listAssetValuations,
  serializeAssetValuation,
} from "../assetValuations";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type AssetValuationsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  parseDateBody: (value: unknown, field: string) => Date;
  transactionDateFilter: (from?: string, to?: string) => { gte?: Date; lte?: Date } | undefined;
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>;
};

export function createAssetValuationsRouter(deps: AssetValuationsDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid, parseDateBody, transactionDateFilter, getFxRatesPlnPerUnit } =
    deps;

  router.get("/api/asset-valuations", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId =
        req.query.accountId != null
          ? parseFiniteNumber(req.query.accountId, "accountId", { min: 1 })
          : undefined;
      const instrumentId =
        req.query.instrumentId != null
          ? parseFiniteNumber(req.query.instrumentId, "instrumentId", { min: 1 })
          : undefined;
      const range = transactionDateFilter(
        req.query.from != null ? String(req.query.from) : undefined,
        req.query.to != null ? String(req.query.to) : undefined,
      );
      const filters: {
        accountId?: number;
        instrumentId?: number;
        from?: Date;
        to?: Date;
      } = {};
      if (accountId != null) filters.accountId = accountId;
      if (instrumentId != null) filters.instrumentId = instrumentId;
      if (range?.gte) filters.from = range.gte;
      if (range?.lte) filters.to = range.lte;
      const rows = await listAssetValuations(prisma, uid(req), filters);
      res.json(rows.map(serializeAssetValuation));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load asset valuations");
    }
  });

  router.post("/api/asset-valuations", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { plnPerUnit } = await getFxRatesPlnPerUnit();
      const createInput: Parameters<typeof createAssetValuation>[2] = {
        valuedOn: parseDateBody(req.body?.date ?? req.body?.valuedOn, "date"),
        value: parseFiniteNumber(req.body?.value, "value", { min: 0 }),
        currency: String(req.body?.currency ?? "PLN"),
        source: req.body?.source != null ? String(req.body.source) : "manual",
        description: req.body?.description != null ? String(req.body.description) : null,
      };
      if (req.body?.accountId != null) {
        createInput.accountId = parseFiniteNumber(req.body.accountId, "accountId", { min: 1 });
      }
      if (req.body?.instrumentId != null) {
        createInput.instrumentId = parseFiniteNumber(req.body.instrumentId, "instrumentId", {
          min: 1,
        });
      }
      const row = await createAssetValuation(prisma, uid(req), createInput, plnPerUnit);
      res.status(201).json(serializeAssetValuation(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create asset valuation");
    }
  });

  router.delete("/api/asset-valuations/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      await deleteAssetValuation(prisma, uid(req), id);
      res.status(204).end();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete asset valuation");
    }
  });

  return router;
}
