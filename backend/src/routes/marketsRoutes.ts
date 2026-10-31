import { Router } from "express";
import { Prisma as PrismaNS, type PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth";
import {
  addInstrumentToAllowlist,
  instrumentPayload,
  parseOptionalAssetClass,
  parseSearchLimit,
  parseSearchQuery,
  parseSearchScope,
  searchInstruments,
} from "../domain/instruments";
import { ensureInstrumentQuote } from "../domain/marketData";
import {
  addToWatchlist,
  listWatchlist,
  removeFromWatchlist,
} from "../domain/watchlist";
import {
  badRequest,
  handleRouteError,
  parseIdParam,
  parsePositiveNumber,
} from "./httpSupport";

type MarketsDeps = {
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

export function createMarketsRouter(deps: MarketsDeps): Router {
  const router = Router();
  const { prisma, requireAuth, uid } = deps;

  router.get(
    "/api/instruments",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const q = parseSearchQuery(req.query.q);
        const assetClass = parseOptionalAssetClass(req.query.assetClass);
        const limit = parseSearchLimit(req.query.limit);
        const scope = parseSearchScope(req.query.scope);
        const rows = await searchInstruments(prisma, {
          q,
          limit,
          scope,
          ...(assetClass != null ? { assetClass } : {}),
        });
        res.json(rows.map(instrumentPayload));
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to search instruments");
      }
    },
  );

  router.post(
    "/api/instruments/allowlist",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const instrumentId = Math.trunc(
          parsePositiveNumber(req.body?.instrumentId, "instrumentId"),
        );
        const row = await addInstrumentToAllowlist(prisma, instrumentId);
        try {
          await ensureInstrumentQuote(prisma, instrumentId);
        } catch {
          // Soft-fail quote; allowlist still succeeds.
        }
        res.status(200).json(instrumentPayload(row));
      } catch (e: unknown) {
        handleRouteError(res, e, "Add to allowlist failed");
      }
    },
  );

  router.get("/api/watchlist", requireAuth, async (req: AuthedRequest, res) => {
    try {
      res.json(await listWatchlist(prisma, uid(req)));
    } catch (e: unknown) {
      handleRouteError(res, e, "Failed to load watchlist");
    }
  });

  router.post(
    "/api/watchlist",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const instrumentId = Math.trunc(
          parsePositiveNumber(req.body?.instrumentId, "instrumentId"),
        );
        const item = await addToWatchlist(prisma, uid(req), instrumentId);
        res.status(201).json(item);
      } catch (e: unknown) {
        if (isUniqueConstraintError(e)) {
          handleRouteError(
            res,
            badRequest("Instrument is already on your watchlist"),
            "Add to watchlist failed",
          );
          return;
        }
        handleRouteError(res, e, "Add to watchlist failed");
      }
    },
  );

  router.delete(
    "/api/watchlist/:instrumentId",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const instrumentId = parseIdParam(req.params.instrumentId);
        await removeFromWatchlist(prisma, uid(req), instrumentId);
        res.status(204).send();
      } catch (e: unknown) {
        handleRouteError(res, e, "Remove from watchlist failed");
      }
    },
  );

  return router;
}
