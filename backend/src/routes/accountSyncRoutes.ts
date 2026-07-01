import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  listAccountSyncSettings,
  runAccountSync,
  serializeAccountSyncSetting,
  upsertAccountSyncSetting,
} from "../accountSync";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type AccountSyncDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>;
};

export function createAccountSyncRouter(deps: AccountSyncDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid, getFxRatesPlnPerUnit } = deps;

  router.get("/api/account-sync", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const rows = await listAccountSyncSettings(prisma, uid(req));
      res.json(rows.map(serializeAccountSyncSetting));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load account sync settings");
    }
  });

  router.put("/api/account-sync/:accountId", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId = parseIdParam(req.params.accountId, "accountId");
      const patch: Parameters<typeof upsertAccountSyncSetting>[3] = {};
      if (req.body?.provider != null) {
        patch.provider = String(req.body.provider) as NonNullable<typeof patch.provider>;
      }
      if (req.body?.syncEnabled != null) patch.syncEnabled = Boolean(req.body.syncEnabled);
      if (req.body?.syncIntervalHours != null) {
        patch.syncIntervalHours = parseFiniteNumber(req.body.syncIntervalHours, "syncIntervalHours", {
          min: 1,
        });
      }
      if (req.body?.configJson !== undefined) {
        patch.configJson = req.body.configJson != null ? String(req.body.configJson) : null;
      }
      const row = await upsertAccountSyncSetting(prisma, uid(req), accountId, patch);
      res.json(serializeAccountSyncSetting(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to save account sync settings");
    }
  });

  router.post("/api/account-sync/:accountId/run", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const accountId = parseIdParam(req.params.accountId, "accountId");
      const result = await runAccountSync(prisma, uid(req), accountId, getFxRatesPlnPerUnit);
      res.json(result);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to run account sync");
    }
  });

  return router;
}
