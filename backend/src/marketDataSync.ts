import type { Prisma, PrismaClient } from "@prisma/client";
import { recomputeAccountValuationsFrom } from "./accountValuation";
import { fetchEodTimeSeries } from "./marketData";
import { mapInstrumentToProviderSymbol } from "./marketDataSymbols";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const MARKET_DATA_SOURCE = "twelve_data";

export type SyncMarketPricesOptions = {
  userId?: number;
  backfillDays?: number;
  apiKey?: string;
  fetchFn?: typeof fetch;
  delayMs?: number;
};

export type SyncMarketPricesResult = {
  synced: number;
  skipped: number;
  valuationsUpserted: number;
  accountsRecomputed: number;
  errors: Array<{ instrumentId: number; symbol: string; message: string }>;
};

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (v && typeof v === "object") {
    const anyV = v as { toNumber?: () => number; toString?: () => string };
    if (typeof anyV.toNumber === "function") return anyV.toNumber();
    if (typeof anyV.toString === "function") return Number(anyV.toString());
  }
  return Number(v);
}

export async function syncMarketPrices(
  prisma: DbClient,
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>,
  opts?: SyncMarketPricesOptions,
): Promise<SyncMarketPricesResult> {
  const backfillDays = Math.max(1, opts?.backfillDays ?? 90);
  const result: SyncMarketPricesResult = {
    synced: 0,
    skipped: 0,
    valuationsUpserted: 0,
    accountsRecomputed: 0,
    errors: [],
  };

  const holdings = await prisma.holding.findMany({
    where: {
      quantity: { gt: 0 },
      ...(opts?.userId != null
        ? { account: { userId: opts.userId } }
        : {}),
    },
    include: { instrument: true, account: { select: { id: true, userId: true } } },
  });

  const instrumentById = new Map<number, (typeof holdings)[0]["instrument"]>();
  for (const h of holdings) {
    instrumentById.set(h.instrumentId, h.instrument);
  }

  const affectedAccountIds = new Set<number>();
  let earliestValuationDate: Date | null = null;

  for (const instrument of instrumentById.values()) {
    const providerSymbol = mapInstrumentToProviderSymbol(instrument);
    if (!providerSymbol) {
      result.skipped += 1;
      result.errors.push({
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        message: `Unmapped exchange or instrument type: ${instrument.exchange ?? "none"} / ${instrument.instrumentType}`,
      });
      continue;
    }

    try {
      const bars = await fetchEodTimeSeries(providerSymbol, {
        outputsize: backfillDays,
        apiKey: opts?.apiKey,
        fetchFn: opts?.fetchFn,
      });

      if (!bars.length) {
        result.skipped += 1;
        result.errors.push({
          instrumentId: instrument.id,
          symbol: instrument.symbol,
          message: "No EOD bars returned",
        });
        continue;
      }

      for (const bar of bars) {
        await prisma.instrumentValuation.upsert({
          where: {
            instrumentId_valuationDate_source: {
              instrumentId: instrument.id,
              valuationDate: bar.date,
              source: MARKET_DATA_SOURCE,
            },
          },
          create: {
            instrumentId: instrument.id,
            valuationDate: bar.date,
            price: bar.close,
            currency: instrument.currency,
            source: MARKET_DATA_SOURCE,
          },
          update: {
            price: bar.close,
            currency: instrument.currency,
            fetchedAt: new Date(),
          },
        });
        result.valuationsUpserted += 1;
        if (!earliestValuationDate || bar.date.getTime() < earliestValuationDate.getTime()) {
          earliestValuationDate = bar.date;
        }
      }

      const holdingAccounts = holdings
        .filter((h) => h.instrumentId === instrument.id)
        .map((h) => h.accountId);
      for (const accountId of holdingAccounts) {
        affectedAccountIds.add(accountId);
      }

      result.synced += 1;

      if (opts?.delayMs && opts.delayMs > 0) {
        await new Promise((r) => setTimeout(r, opts.delayMs));
      }
    } catch (e: unknown) {
      result.skipped += 1;
      result.errors.push({
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        message: e instanceof Error ? e.message : "Sync failed",
      });
    }
  }

  if (affectedAccountIds.size && earliestValuationDate) {
    const { plnPerUnit } = await getFxRatesPlnPerUnit();
    for (const accountId of affectedAccountIds) {
      await recomputeAccountValuationsFrom(prisma, accountId, earliestValuationDate, plnPerUnit);
      result.accountsRecomputed += 1;
    }
  }

  return result;
}

export async function getMarketDataStatus(
  prisma: DbClient,
  userId: number,
): Promise<{
  lastSyncAt: string | null;
  instrumentCount: number;
  staleCount: number;
}> {
  const holdings = await prisma.holding.findMany({
    where: { quantity: { gt: 0 }, account: { userId } },
    select: { instrumentId: true },
    distinct: ["instrumentId"],
  });

  const instrumentIds = holdings.map((h) => h.instrumentId);
  if (!instrumentIds.length) {
    return { lastSyncAt: null, instrumentCount: 0, staleCount: 0 };
  }

  const valuations = await prisma.instrumentValuation.findMany({
    where: { instrumentId: { in: instrumentIds }, source: MARKET_DATA_SOURCE },
    orderBy: { fetchedAt: "desc" },
    select: { instrumentId: true, fetchedAt: true, valuationDate: true },
  });

  let lastSyncAt: Date | null = null;
  const latestByInstrument = new Map<number, Date>();
  for (const v of valuations) {
    if (!lastSyncAt || v.fetchedAt.getTime() > lastSyncAt.getTime()) {
      lastSyncAt = v.fetchedAt;
    }
    const prev = latestByInstrument.get(v.instrumentId);
    if (!prev || v.valuationDate.getTime() > prev.getTime()) {
      latestByInstrument.set(v.instrumentId, v.valuationDate);
    }
  }

  const staleCutoff = new Date();
  staleCutoff.setUTCDate(staleCutoff.getUTCDate() - 3);

  let staleCount = 0;
  for (const instrumentId of instrumentIds) {
    const latest = latestByInstrument.get(instrumentId);
    if (!latest || latest.getTime() < staleCutoff.getTime()) {
      staleCount += 1;
    }
  }

  return {
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    instrumentCount: instrumentIds.length,
    staleCount,
  };
}
