import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createCouponSchedule,
  deleteCouponSchedule,
  listCouponSchedules,
  parseCouponScheduleType,
  recordCouponScheduleAsIncome,
  serializeCouponSchedule,
} from "../couponSchedules";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type CouponSchedulesDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  parseDateBody: (value: unknown, field: string) => Date;
  transactionDateFilter: (from?: string, to?: string) => { gte?: Date; lte?: Date } | undefined;
};

export function createCouponSchedulesRouter(deps: CouponSchedulesDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid, parseDateBody, transactionDateFilter } = deps;

  router.get("/api/coupon-schedules", requireAuth, async (req: AuthedRequest, res) => {
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
      const rows = await listCouponSchedules(prisma, uid(req), filters);
      res.json(rows.map(serializeCouponSchedule));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load coupon schedules");
    }
  });

  router.post("/api/coupon-schedules", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const createInput: Parameters<typeof createCouponSchedule>[2] = {
        accountId: parseFiniteNumber(req.body?.accountId, "accountId", { min: 1 }),
        instrumentId: parseFiniteNumber(req.body?.instrumentId, "instrumentId", { min: 1 }),
        scheduleType: parseCouponScheduleType(req.body?.scheduleType),
        paymentOn: parseDateBody(req.body?.date ?? req.body?.paymentOn, "date"),
        amount: parseFiniteNumber(req.body?.amount, "amount", { min: 0.0001 }),
        currency: String(req.body?.currency ?? "PLN"),
        description: req.body?.description != null ? String(req.body.description) : null,
      };
      const row = await createCouponSchedule(prisma, uid(req), createInput);
      res.status(201).json(serializeCouponSchedule(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create coupon schedule");
    }
  });

  router.post("/api/coupon-schedules/:id/record-income", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      const row = await recordCouponScheduleAsIncome(prisma, uid(req), id);
      res.json(serializeCouponSchedule(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to record coupon as income");
    }
  });

  router.delete("/api/coupon-schedules/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      await deleteCouponSchedule(prisma, uid(req), id);
      res.status(204).end();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete coupon schedule");
    }
  });

  return router;
}
