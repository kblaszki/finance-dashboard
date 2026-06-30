import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  createDocumentAttachment,
  deleteDocumentAttachment,
  listDocumentAttachments,
  serializeDocumentAttachment,
} from "../documentAttachments";
import { handleRouteError, parseFiniteNumber, parseIdParam } from "./httpSupport";

type DocumentAttachmentsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

export function createDocumentAttachmentsRouter(deps: DocumentAttachmentsDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/document-attachments", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const entityType = req.query.entityType != null ? String(req.query.entityType) : undefined;
      const entityId =
        req.query.entityId != null
          ? parseFiniteNumber(req.query.entityId, "entityId", { min: 1 })
          : undefined;
      const filters: { entityType?: string; entityId?: number } = {};
      if (entityType) filters.entityType = entityType;
      if (entityId != null) filters.entityId = entityId;
      const rows = await listDocumentAttachments(prisma, uid(req), filters);
      res.json(rows.map(serializeDocumentAttachment));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load attachments");
    }
  });

  router.post("/api/document-attachments", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const row = await createDocumentAttachment(prisma, uid(req), {
        entityType: String(req.body?.entityType ?? ""),
        entityId: parseFiniteNumber(req.body?.entityId, "entityId", { min: 1 }),
        filename: String(req.body?.filename ?? ""),
        mimeType: req.body?.mimeType != null ? String(req.body.mimeType) : null,
        storageRef: req.body?.storageRef != null ? String(req.body.storageRef) : null,
        description: req.body?.description != null ? String(req.body.description) : null,
      });
      res.status(201).json(serializeDocumentAttachment(row));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to create attachment");
    }
  });

  router.delete("/api/document-attachments/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = parseIdParam(req.params.id, "id");
      await deleteDocumentAttachment(prisma, uid(req), id);
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to delete attachment");
    }
  });

  return router;
}
