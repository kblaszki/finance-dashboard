import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import { exportUserData } from "../dataExport";
import { listAuditLogs, serializeAuditLog } from "../auditLog";
import { handleRouteError } from "./httpSupport";

type ExportAuditDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

export function createExportRouter(deps: ExportAuditDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/export/full", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const data = await exportUserData(prisma, uid(req));
      const format = String(req.query.format ?? "json").toLowerCase();
      if (format === "json") {
        res.setHeader("Content-Disposition", 'attachment; filename="finance-export.json"');
        res.json(data);
        return;
      }
      res.status(400).json({ error: "Only format=json is supported in MVP" });
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to export data");
    }
  });

  router.get("/api/audit-logs", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const entityType =
        req.query.entityType != null ? String(req.query.entityType) : undefined;
      const limit =
        req.query.limit != null ? Number(req.query.limit) : undefined;
      const filters: { entityType?: string; limit?: number } = {};
      if (entityType) filters.entityType = entityType;
      if (limit != null && Number.isFinite(limit)) filters.limit = limit;
      const rows = await listAuditLogs(prisma, uid(req), filters);
      res.json(rows.map(serializeAuditLog));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load audit logs");
    }
  });

  return router;
}
