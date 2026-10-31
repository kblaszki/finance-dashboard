import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  getAppConfigPayload,
  setMarketLiveApi,
} from "../domain/appConfig";
import { badRequest, handleRouteError } from "./httpSupport";

type AppConfigDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
};

export function createAppConfigRouter(deps: AppConfigDeps): Router {
  const router = Router();
  const { prisma, requireAuth } = deps;

  router.get("/api/app-config", requireAuth, async (_req, res) => {
    try {
      res.json(await getAppConfigPayload(prisma));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load app config");
    }
  });

  router.patch("/api/app-config", requireAuth, async (req: AuthedRequest, res) => {
    try {
      if (typeof req.body?.marketLiveApi !== "boolean") {
        throw badRequest("marketLiveApi must be a boolean");
      }
      await setMarketLiveApi(prisma, req.body.marketLiveApi);
      res.json(await getAppConfigPayload(prisma));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to update app config");
    }
  });

  return router;
}
