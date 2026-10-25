import { Router } from "express";
import { Prisma as PrismaNS, type PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  assertPresetNameUnique,
  csvImportPresetPayload,
  findOwnedCsvImportPreset,
  parsePresetName,
  presetNameKey,
  serializeNamedMapping,
} from "../domain/csvImportPresets";
import { findOwnedAccount } from "../domain/ownedAccount";
import {
  badRequest,
  handleRouteError,
  parseIdParam,
} from "./httpSupport";

type Deps = {
  prisma: PrismaClient;
  requireAuth: (req: AuthedRequest, res: any, next: any) => void;
  uid: (req: AuthedRequest) => number;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof PrismaNS.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function parseHeaders(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw badRequest("headers array required");
  }
  return raw.map((h) => String(h ?? ""));
}

export function createCsvImportPresetsRouter(deps: Deps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get(
    "/api/accounts/:accountId/import-presets",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const userId = uid(req);
        await findOwnedAccount(prisma, userId, accountId);
        const rows = await prisma.csvImportPreset.findMany({
          where: { userId, accountId },
          orderBy: { name: "asc" },
        });
        res.json(rows.map(csvImportPresetPayload));
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to list import presets");
      }
    },
  );

  router.post(
    "/api/accounts/:accountId/import-presets",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const userId = uid(req);
        await findOwnedAccount(prisma, userId, accountId);
        const name = parsePresetName(req.body?.name);
        const headers = parseHeaders(req.body?.headers);
        const named = serializeNamedMapping(headers, req.body?.columnMapping);
        await assertPresetNameUnique(prisma, accountId, name);
        const created = await prisma.csvImportPreset.create({
          data: {
            userId,
            accountId,
            name,
            nameKey: presetNameKey(name),
            mappingJson: JSON.stringify(named),
          },
        });
        res.status(201).json(csvImportPresetPayload(created));
      } catch (e: unknown) {
        if (isUniqueConstraintError(e)) {
          handleRouteError(
            res,
            badRequest(
              "A preset with this name already exists on this account",
            ),
            "Create import preset failed",
          );
          return;
        }
        handleRouteError(res, e, "Create import preset failed");
      }
    },
  );

  router.patch(
    "/api/accounts/:accountId/import-presets/:id",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const id = parseIdParam(req.params.id);
        const userId = uid(req);
        await findOwnedAccount(prisma, userId, accountId);
        const existing = await findOwnedCsvImportPreset(
          prisma,
          userId,
          accountId,
          id,
        );

        const data: {
          name?: string;
          nameKey?: string;
          mappingJson?: string;
        } = {};

        if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "name")) {
          const name = parsePresetName(req.body.name);
          await assertPresetNameUnique(prisma, accountId, name, id);
          data.name = name;
          data.nameKey = presetNameKey(name);
        }

        if (
          Object.prototype.hasOwnProperty.call(req.body ?? {}, "columnMapping")
        ) {
          const headers = parseHeaders(req.body?.headers);
          const named = serializeNamedMapping(
            headers,
            req.body.columnMapping,
          );
          data.mappingJson = JSON.stringify(named);
        }

        if (Object.keys(data).length === 0) {
          throw badRequest("name or columnMapping required");
        }

        const updated = await prisma.csvImportPreset.update({
          where: { id: existing.id },
          data,
        });
        res.json(csvImportPresetPayload(updated));
      } catch (e: unknown) {
        if (isUniqueConstraintError(e)) {
          handleRouteError(
            res,
            badRequest(
              "A preset with this name already exists on this account",
            ),
            "Update import preset failed",
          );
          return;
        }
        handleRouteError(res, e, "Update import preset failed");
      }
    },
  );

  router.delete(
    "/api/accounts/:accountId/import-presets/:id",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const accountId = parseIdParam(req.params.accountId, "accountId");
        const id = parseIdParam(req.params.id);
        const userId = uid(req);
        await findOwnedAccount(prisma, userId, accountId);
        await findOwnedCsvImportPreset(prisma, userId, accountId, id);
        await prisma.csvImportPreset.delete({ where: { id } });
        res.status(204).send();
      } catch (e: unknown) {
        handleRouteError(res, e, "Delete import preset failed");
      }
    },
  );

  return router;
}
