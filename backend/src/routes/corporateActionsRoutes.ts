import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createCorporateAction,
  listCorporateActions,
  parseCorporateActionType,
  serializeCorporateAction,
} from "../corporateActions";
import { handleRouteError, parseFiniteNumber } from "./httpSupport";

type CorporateActionsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  parseDateBody: (value: unknown) => Date;
  transactionDateFilter: (from?: unknown, to?: unknown) => { gte?: Date; lte?: Date } | undefined;
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>;
  recomputeAccountValuationsFrom: (
    db: any,
    accountId: number,
    fromDate: Date,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
};

export function createCorporateActionsRouter(deps: CorporateActionsDeps): Router {
  const router = Router();
  const {
    prisma,
    requireAuth,
    uid,
    parseDateBody,
    transactionDateFilter,
    getFxRatesPlnPerUnit,
    recomputeAccountValuationsFrom,
  } = deps;

  router.get("/api/corporate-actions", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId =
        req.query.accountId != null
          ? parseFiniteNumber(req.query.accountId, "accountId", { min: 1 })
          : undefined;
      const range = transactionDateFilter(req.query.from, req.query.to);
      const filters: { accountId?: number; from?: Date; to?: Date } = {};
      if (accountId != null) filters.accountId = accountId;
      if (range?.gte) filters.from = range.gte;
      if (range?.lte) filters.to = range.lte;
      const rows = await listCorporateActions(prisma, uid(req), filters);
      res.json(rows.map(serializeCorporateAction));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load corporate actions");
    }
  });

  router.post("/api/corporate-actions", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const createInput: Parameters<typeof createCorporateAction>[2] = {
        accountId: parseFiniteNumber(req.body?.accountId, "accountId", { min: 1 }),
        instrumentId: parseFiniteNumber(req.body?.instrumentId, "instrumentId", { min: 1 }),
        actionType: parseCorporateActionType(req.body?.actionType),
        actionDate: parseDateBody(req.body?.actionDate ?? req.body?.date),
        notes: req.body?.notes != null ? String(req.body.notes) : null,
      };
      if (req.body?.holdingId != null) {
        createInput.holdingId = parseFiniteNumber(req.body.holdingId, "holdingId", { min: 1 });
      }
      if (req.body?.ratio != null) {
        createInput.ratio = parseFiniteNumber(req.body.ratio, "ratio", { min: 0.0001 });
      }
      if (req.body?.quantityDelta != null) {
        createInput.quantityDelta = parseFiniteNumber(req.body.quantityDelta, "quantityDelta");
      }
      const row = await createCorporateAction(prisma, uid(req), createInput, {
        getFxRatesPlnPerUnit,
        recomputeAccountValuationsFrom,
      });
      res.status(201).json(serializeCorporateAction(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create corporate action");
    }
  });

  return router;
}
