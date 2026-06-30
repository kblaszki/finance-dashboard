import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createPropertyCashFlow,
  deletePropertyCashFlow,
  listPropertyCashFlows,
  parsePropertyFlowType,
  serializePropertyCashFlow,
  updatePropertyCashFlow,
} from "../propertyCashFlows";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type PropertyCashFlowsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  parseDateBody: (value: unknown, field: string) => Date;
  transactionDateFilter: (from?: string, to?: string) => { gte?: Date; lte?: Date } | undefined;
};

export function createPropertyCashFlowsRouter(deps: PropertyCashFlowsDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid, parseDateBody, transactionDateFilter } = deps;

  router.get("/api/property-cash-flows", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId =
        req.query.accountId != null
          ? parseFiniteNumber(req.query.accountId, "accountId", { min: 1 })
          : undefined;
      const range = transactionDateFilter(
        req.query.from != null ? String(req.query.from) : undefined,
        req.query.to != null ? String(req.query.to) : undefined,
      );
      const filters: { accountId?: number; from?: Date; to?: Date } = {};
      if (accountId != null) filters.accountId = accountId;
      if (range?.gte) filters.from = range.gte;
      if (range?.lte) filters.to = range.lte;
      const rows = await listPropertyCashFlows(prisma, uid(req), filters);
      res.json(rows.map(serializePropertyCashFlow));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load property cash flows");
    }
  });

  router.post("/api/property-cash-flows", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const createInput: Parameters<typeof createPropertyCashFlow>[2] = {
        accountId: parseFiniteNumber(req.body?.accountId, "accountId", { min: 1 }),
        flowType: parsePropertyFlowType(req.body?.flowType),
        amount: parseFiniteNumber(req.body?.amount, "amount", { min: 0.0001 }),
        currency: String(req.body?.currency ?? "PLN"),
        occurredOn: parseDateBody(req.body?.date ?? req.body?.occurredOn, "date"),
        description: req.body?.description != null ? String(req.body.description) : null,
      };
      const row = await createPropertyCashFlow(prisma, uid(req), createInput);
      res.status(201).json(serializePropertyCashFlow(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create property cash flow");
    }
  });

  router.put("/api/property-cash-flows/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      const patch: Parameters<typeof updatePropertyCashFlow>[3] = {};
      if (req.body?.accountId != null) {
        patch.accountId = parseFiniteNumber(req.body.accountId, "accountId", { min: 1 });
      }
      if (req.body?.flowType != null) patch.flowType = parsePropertyFlowType(req.body.flowType);
      if (req.body?.amount != null) patch.amount = parseFiniteNumber(req.body.amount, "amount", { min: 0.0001 });
      if (req.body?.currency != null) patch.currency = String(req.body.currency);
      if (req.body?.date != null || req.body?.occurredOn != null) {
        patch.occurredOn = parseDateBody(req.body?.date ?? req.body?.occurredOn, "date");
      }
      if (req.body?.description !== undefined) patch.description = String(req.body.description);
      const row = await updatePropertyCashFlow(prisma, uid(req), id, patch);
      res.json(serializePropertyCashFlow(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to update property cash flow");
    }
  });

  router.delete("/api/property-cash-flows/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      await deletePropertyCashFlow(prisma, uid(req), id);
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete property cash flow");
    }
  });

  return router;
}
