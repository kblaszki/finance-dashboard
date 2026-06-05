import type { PrismaClient } from "@prisma/client";
import type { EodPriceProvider } from "./marketData";

const HISTORY_START = new Date(Date.UTC(2020, 0, 1));
const DEFAULT_SOURCE = "twelve_data";

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export async function findOrCreateAsset(
  prisma: PrismaClient,
  symbol: string,
  currency: string,
  assetType = "STOCK",
) {
  const sym = normalizeSymbol(symbol);
  const existing = await prisma.asset.findFirst({
    where: { symbol: sym, source: DEFAULT_SOURCE, exchange: null },
  });
  if (existing) return existing;
  return prisma.asset.create({
    data: {
      symbol: sym,
      assetType,
      currency: currency.trim().toUpperCase(),
      exchange: null,
      source: DEFAULT_SOURCE,
    },
  });
}

export async function ensureAssetWithHistory(
  prisma: PrismaClient,
  provider: EodPriceProvider | null,
  symbol: string,
  currency: string,
): Promise<{ assetId: number; fetched: boolean }> {
  const asset = await findOrCreateAsset(prisma, symbol, currency);
  const count = await prisma.marketPriceDaily.count({
    where: { assetId: asset.id, source: provider?.source ?? DEFAULT_SOURCE },
  });
  if (count > 0 || !provider) {
    return { assetId: asset.id, fetched: false };
  }
  const end = new Date();
  const points = await provider.fetchDailyHistory(asset.symbol, HISTORY_START, end);
  if (points.length) {
    for (const p of points) {
      await prisma.marketPriceDaily.upsert({
        where: {
          assetId_priceDate_source: {
            assetId: asset.id,
            priceDate: p.priceDate,
            source: p.source,
          },
        },
        create: {
          assetId: asset.id,
          close: p.close,
          priceDate: p.priceDate,
          source: p.source,
          fetchedAt: new Date(),
        },
        update: { close: p.close, fetchedAt: new Date() },
      });
    }
  }
  return { assetId: asset.id, fetched: true };
}

export async function getLatestPricesByAssetIds(
  prisma: PrismaClient,
  assetIds: number[],
): Promise<Map<number, { close: number; priceDate: Date; currency: string }>> {
  const map = new Map<number, { close: number; priceDate: Date; currency: string }>();
  if (!assetIds.length) return map;
  const rows = await prisma.marketPriceDaily.findMany({
    where: { assetId: { in: assetIds } },
    orderBy: [{ assetId: "asc" }, { priceDate: "desc" }],
    include: { asset: true },
  });
  for (const row of rows) {
    if (!map.has(row.assetId)) {
      map.set(row.assetId, {
        close: Number(row.close),
        priceDate: row.priceDate,
        currency: row.asset.currency,
      });
    }
  }
  return map;
}

export async function getLatestPricesBySymbols(
  prisma: PrismaClient,
  symbols: string[],
): Promise<Map<string, { close: number; priceDate: Date; currency: string; assetId: number }>> {
  const normalized = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
  const assets = await prisma.asset.findMany({
    where: { symbol: { in: normalized }, exchange: null, source: DEFAULT_SOURCE },
  });
  const byAsset = await getLatestPricesByAssetIds(
    prisma,
    assets.map((a) => a.id),
  );
  const map = new Map<string, { close: number; priceDate: Date; currency: string; assetId: number }>();
  for (const asset of assets) {
    const price = byAsset.get(asset.id);
    if (price) map.set(asset.symbol, { ...price, assetId: asset.id });
  }
  return map;
}
