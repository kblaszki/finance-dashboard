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
import {
  historyWindowForYear,
  historyWindowFromMonths,
  instrumentCloseYearBounds,
  listInstrumentCloses,
  parseInstrumentHistoryMonths,
  parseInstrumentHistoryYear,
} from "../domain/instrumentValuations";
import { ensureInstrumentQuote } from "../domain/marketData";
import { ensureInstrumentHistory } from "../domain/marketHistory";
import {
  addToWatchlist,
  listWatchlist,
  removeFromWatchlist,
} from "../domain/watchlist";
import { notFound } from "../lib/errors";
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

  router.get(
    "/api/instruments/:instrumentId/history",
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const instrumentId = parseIdParam(req.params.instrumentId);
        const year = parseInstrumentHistoryYear(req.query.year);
        const months =
          year == null ? parseInstrumentHistoryMonths(req.query.months) : null;
        const instrument = await prisma.instrument.findUnique({
          where: { id: instrumentId },
        });
        if (!instrument) {
          throw notFound("Instrument not found");
        }

        const ensure = await ensureInstrumentHistory(prisma, instrumentId);
        const range =
          year != null
            ? historyWindowForYear(year)
            : historyWindowFromMonths(months!);
        const [series, yearBounds] = await Promise.all([
          listInstrumentCloses(prisma, instrumentId, range),
          instrumentCloseYearBounds(prisma, instrumentId),
        ]);

        res.json({
          instrument: instrumentPayload(instrument),
          currency: instrument.currency,
          months,
          year,
          oldestYear: yearBounds.oldestYear,
          newestYear: yearBounds.newestYear,
          from: range.fromYmd,
          to: range.toYmd,
          series,
          backfilled: ensure.backfilled,
          ...(ensure.backfillMessage != null
            ? { backfillMessage: ensure.backfillMessage }
            : {}),
        });
      } catch (e: unknown) {
        handleRouteError(res, e, "Failed to load instrument history");
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
