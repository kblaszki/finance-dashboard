import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createPositionTransfer,
  listPositionTransfers,
  serializePositionTransfer,
} from "../positionTransfers";
import { handleRouteError, parseFiniteNumber, parsePositiveNumber } from "./httpSupport";

type PositionTransfersDeps = {
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

export function createPositionTransfersRouter(deps: PositionTransfersDeps): Router {
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

  router.get("/api/position-transfers", requireAuth, async (req: AuthedRequest, res) => {
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
      const rows = await listPositionTransfers(prisma, uid(req), filters);
      res.json(rows.map(serializePositionTransfer));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load position transfers");
    }
  });

  router.post("/api/position-transfers", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const row = await createPositionTransfer(
        prisma,
        uid(req),
        {
          fromAccountId: parseFiniteNumber(req.body?.fromAccountId, "fromAccountId", { min: 1 }),
          toAccountId: parseFiniteNumber(req.body?.toAccountId, "toAccountId", { min: 1 }),
          instrumentId: parseFiniteNumber(req.body?.instrumentId, "instrumentId", { min: 1 }),
          quantity: parsePositiveNumber(req.body?.quantity, "quantity"),
          transferDate: parseDateBody(req.body?.transferDate ?? req.body?.date),
        },
        { getFxRatesPlnPerUnit, recomputeAccountValuationsFrom },
      );
      res.status(201).json(serializePositionTransfer(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create position transfer");
    }
  });

  return router;
}
