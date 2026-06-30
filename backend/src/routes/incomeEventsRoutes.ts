import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createUserIncomeEvent,
  deleteUserIncomeEvent,
  listUserIncomeEvents,
  parseIncomeEventType,
  parseIncomeTaxType,
  serializeIncomeEvent,
  updateUserIncomeEvent,
} from "../incomeEvents";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type IncomeEventsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  parseDateBody: (value: unknown, field: string) => Date;
  transactionDateFilter: (from?: string, to?: string) => { gte?: Date; lte?: Date } | undefined;
};

export function createIncomeEventsRouter(deps: IncomeEventsDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid, parseDateBody, transactionDateFilter } = deps;

  router.get("/api/income-events", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const accountId =
        req.query.accountId != null
          ? parseFiniteNumber(req.query.accountId, "accountId", { min: 1 })
          : undefined;
      const range = transactionDateFilter(
        req.query.from != null ? String(req.query.from) : undefined,
        req.query.to != null ? String(req.query.to) : undefined,
      );
      const filters: { from?: Date; to?: Date; accountId?: number } = {};
      if (accountId != null) filters.accountId = accountId;
      if (range?.gte) filters.from = range.gte;
      if (range?.lte) filters.to = range.lte;
      const rows = await listUserIncomeEvents(prisma, userId, filters);
      res.json(rows.map(serializeIncomeEvent));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load income events");
    }
  });

  router.post("/api/income-events", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const createInput: Parameters<typeof createUserIncomeEvent>[2] = {
        accountId: parseFiniteNumber(req.body?.accountId, "accountId", { min: 1 }),
        instrumentId:
          req.body?.instrumentId != null
            ? parseFiniteNumber(req.body.instrumentId, "instrumentId", { min: 1 })
            : null,
        eventType: parseIncomeEventType(req.body?.eventType),
        taxType: parseIncomeTaxType(req.body?.taxType),
        amount: parseFiniteNumber(req.body?.amount, "amount", { min: 0.0001 }),
        currency: String(req.body?.currency ?? "PLN"),
        occurredOn: parseDateBody(req.body?.date ?? req.body?.occurredOn, "date"),
        description: req.body?.description != null ? String(req.body.description) : null,
      };
      if (req.body?.withheldTax != null) {
        createInput.withheldTax = parseFiniteNumber(req.body.withheldTax, "withheldTax", { min: 0 });
      }
      if (req.body?.sourceCountry != null) {
        createInput.sourceCountry = String(req.body.sourceCountry);
      }
      if (req.body?.foreignTaxPaid != null) {
        createInput.foreignTaxPaid = parseFiniteNumber(
          req.body.foreignTaxPaid,
          "foreignTaxPaid",
          { min: 0 },
        );
      }
      const row = await createUserIncomeEvent(prisma, uid(req), createInput);
      res.status(201).json(serializeIncomeEvent(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create income event");
    }
  });

  router.put("/api/income-events/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      const patch: Parameters<typeof updateUserIncomeEvent>[3] = {};
      if (req.body?.accountId != null) {
        patch.accountId = parseFiniteNumber(req.body.accountId, "accountId", { min: 1 });
      }
      if (req.body?.instrumentId !== undefined) {
        patch.instrumentId =
          req.body.instrumentId == null
            ? null
            : parseFiniteNumber(req.body.instrumentId, "instrumentId", { min: 1 });
      }
      if (req.body?.eventType != null) patch.eventType = parseIncomeEventType(req.body.eventType);
      if (req.body?.taxType !== undefined) patch.taxType = parseIncomeTaxType(req.body.taxType);
      if (req.body?.amount != null) patch.amount = parseFiniteNumber(req.body.amount, "amount", { min: 0.0001 });
      if (req.body?.currency != null) patch.currency = String(req.body.currency);
      if (req.body?.date != null || req.body?.occurredOn != null) {
        patch.occurredOn = parseDateBody(req.body?.date ?? req.body?.occurredOn, "date");
      }
      if (req.body?.description !== undefined) patch.description = String(req.body.description);
      if (req.body?.withheldTax != null) {
        patch.withheldTax = parseFiniteNumber(req.body.withheldTax, "withheldTax", { min: 0 });
      }
      if (req.body?.sourceCountry !== undefined) patch.sourceCountry = String(req.body.sourceCountry);
      if (req.body?.foreignTaxPaid != null) {
        patch.foreignTaxPaid = parseFiniteNumber(req.body.foreignTaxPaid, "foreignTaxPaid", { min: 0 });
      }
      const row = await updateUserIncomeEvent(prisma, uid(req), id, patch);
      res.json(serializeIncomeEvent(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to update income event");
    }
  });

  router.delete("/api/income-events/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      await deleteUserIncomeEvent(prisma, uid(req), id);
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete income event");
    }
  });

  return router;
}
