import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createImportPreset,
  deleteImportPreset,
  listImportPresets,
  serializeImportPreset,
} from "../importPresets";
import { handleRouteError, parseIdParam } from "./httpSupport";

type ImportPresetsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

export function createImportPresetsRouter(deps: ImportPresetsDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/import/presets", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const data = await listImportPresets(prisma, uid(req));
      res.json(data);
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load import presets");
    }
  });

  router.post("/api/import/presets", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const row = await createImportPreset(prisma, uid(req), {
        name: String(req.body?.name ?? ""),
        broker: String(req.body?.broker ?? ""),
        targetType: String(req.body?.targetType ?? ""),
        columnMapping:
          req.body?.columnMapping != null && typeof req.body.columnMapping === "object"
            ? (req.body.columnMapping as Record<string, string>)
            : {},
      });
      res.status(201).json(serializeImportPreset(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create import preset");
    }
  });

  router.delete("/api/import/presets/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      await deleteImportPreset(prisma, uid(req), id);
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete import preset");
    }
  });

  return router;
}
