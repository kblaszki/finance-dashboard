import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest, conflict, notFound } from "../lib/errors";
import { formatYmdUtc } from "./fx";
import { findInstrumentById, instrumentPayload } from "./instruments";
import { getLatestValuation } from "./instrumentValuations";
import { ensureInstrumentQuote } from "./marketData";
import type { TwelveDataFetch } from "./twelveDataClient";

type Db = PrismaClient | Prisma.TransactionClient;

export type WatchlistListItem = {
  instrumentId: number;
  createdAt: string;
  instrument: ReturnType<typeof instrumentPayload>;
  lastClose: number | null;
  asOf: string | null;
};

function valuationFields(
  valuation: { asOfDate: Date; close: Prisma.Decimal } | null,
): { lastClose: number | null; asOf: string | null } {
  if (!valuation) return { lastClose: null, asOf: null };
  return {
    lastClose: Number(valuation.close),
    asOf: formatYmdUtc(valuation.asOfDate),
  };
}

export async function listWatchlist(
  db: Db,
  userId: number,
): Promise<WatchlistListItem[]> {
  const rows = await db.watchlistItem.findMany({
    where: { userId },
    include: { instrument: true },
    orderBy: { createdAt: "desc" },
  });
  const out: WatchlistListItem[] = [];
  for (const row of rows) {
    const valuation = await getLatestValuation(db, row.instrumentId);
    out.push({
      instrumentId: row.instrumentId,
      createdAt: row.createdAt.toISOString(),
      instrument: instrumentPayload(row.instrument),
      ...valuationFields(valuation),
    });
  }
  return out;
}

export async function addToWatchlist(
  prisma: PrismaClient,
  userId: number,
  instrumentId: number,
  fetchImpl?: TwelveDataFetch,
): Promise<WatchlistListItem> {
  if (!Number.isInteger(instrumentId) || instrumentId < 1) {
    throw badRequest("instrumentId must be a positive integer");
  }
  await findInstrumentById(prisma, instrumentId);

  const existing = await prisma.watchlistItem.findUnique({
    where: {
      userId_instrumentId: { userId, instrumentId },
    },
  });
  if (existing) {
    throw conflict("Instrument is already on your watchlist");
  }

  const created = await prisma.watchlistItem.create({
    data: { userId, instrumentId },
    include: { instrument: true },
  });

  try {
    await ensureInstrumentQuote(prisma, instrumentId, fetchImpl);
  } catch {
    // Keep favorite even if quote fails; UI shows null close.
  }

  const valuation = await getLatestValuation(prisma, instrumentId);
  return {
    instrumentId: created.instrumentId,
    createdAt: created.createdAt.toISOString(),
    instrument: instrumentPayload(created.instrument),
    ...valuationFields(valuation),
  };
}

export async function removeFromWatchlist(
  db: Db,
  userId: number,
  instrumentId: number,
): Promise<void> {
  if (!Number.isInteger(instrumentId) || instrumentId < 1) {
    throw badRequest("instrumentId must be a positive integer");
  }
  const row = await db.watchlistItem.findFirst({
    where: { userId, instrumentId },
  });
  if (!row) throw notFound("Watchlist item not found");
  await db.watchlistItem.delete({ where: { id: row.id } });
}
