import { Router } from "express";
import { Prisma as PrismaNS, type PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  assertTagNameUnique,
  findOwnedTag,
  parseTagName,
  tagNameKey,
  tagPayload,
} from "../domain/tags";
import { badRequest, handleRouteError, parseIdParam } from "./httpSupport";

type TagsDeps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof PrismaNS.PrismaClientKnownRequestError && error.code === "P2002";
}

export function createTagsRouter(deps: TagsDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get("/api/tags", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const rows = await prisma.tag.findMany({
        where: { userId: uid(req) },
        orderBy: { name: "asc" },
      });
      res.json(rows.map(tagPayload));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to list tags");
    }
  });

  router.post("/api/tags", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const name = parseTagName(req.body?.name);
      await assertTagNameUnique(prisma, userId, name);
      const created = await prisma.tag.create({
        data: {
          userId,
          name,
          nameKey: tagNameKey(name),
        },
      });
      res.status(201).json(tagPayload(created));
    } catch (e: unknown) {
      if (isUniqueConstraintError(e)) {
        handleRouteError(
          res,
          badRequest("A tag with this name already exists"),
          "Create tag failed",
        );
        return;
      }
      handleRouteError(res, e, "Create tag failed");
    }
  });

  router.patch("/api/tags/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const id = parseIdParam(req.params.id);
      if (!Object.prototype.hasOwnProperty.call(req.body ?? {}, "name")) {
        throw badRequest("name required");
      }
      const name = parseTagName(req.body.name);
      await findOwnedTag(prisma, userId, id);
      await assertTagNameUnique(prisma, userId, name, id);
      const updated = await prisma.tag.update({
        where: { id },
        data: { name, nameKey: tagNameKey(name) },
      });
      res.json(tagPayload(updated));
    } catch (e: unknown) {
      if (isUniqueConstraintError(e)) {
        handleRouteError(
          res,
          badRequest("A tag with this name already exists"),
          "Update tag failed",
        );
        return;
      }
      handleRouteError(res, e, "Update tag failed");
    }
  });

  router.delete("/api/tags/:id", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = uid(req);
      const id = parseIdParam(req.params.id);
      await findOwnedTag(prisma, userId, id);
      await prisma.tag.delete({ where: { id } });
      res.status(204).send();
    } catch (e: unknown) {
      handleRouteError(res, e, "Delete tag failed");
    }
  });

  return router;
}
