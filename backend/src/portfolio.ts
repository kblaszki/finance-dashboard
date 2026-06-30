import type { Prisma, PrismaClient } from "@prisma/client";
import {
  buildHoldingSummary,
  type HoldingSummary,
} from "./holdings";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const ASSET_BUCKETS = [
  "stock_market",
  "crypto",
  "precious_metal_other",
  "real_estate",
] as const;

export type AssetBucket = (typeof ASSET_BUCKETS)[number];

export type PortfolioPosition = HoldingSummary & {
  accountName: string;
  accountType: string;
  accountCurrency: string;
  assetBucket: AssetBucket;
};

export type PortfolioFilters = {
  accountId?: number;
  instrumentType?: string;
  assetBucket?: string;
};

export function inferAssetBucket(accountType: string, instrumentType: string): AssetBucket {
  const instrument = instrumentType.toUpperCase();
  if (instrument === "CRYPTO") return "crypto";
  if (["GOLD", "SILVER", "METAL", "PRECIOUS_METAL"].includes(instrument)) {
    return "precious_metal_other";
  }
  if (accountType === "MANUAL") return "real_estate";
  return "stock_market";
}

export async function getUserPortfolioPositions(
  prisma: DbClient,
  userId: number,
  plnPerUnit: Record<string, number>,
  filters: PortfolioFilters = {},
): Promise<PortfolioPosition[]> {
  const accounts = await prisma.account.findMany({
    where: {
      userId,
      ...(filters.accountId != null ? { id: filters.accountId } : {}),
    },
    orderBy: { name: "asc" },
  });
  if (!accounts.length) return [];

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const accountIds = accounts.map((a) => a.id);

  const rows = await prisma.holding.findMany({
    where: {
      accountId: { in: accountIds },
      quantity: { gt: 0 },
    },
    include: {
      instrument: true,
      lots: { orderBy: [{ tradeDate: "asc" }, { id: "asc" }] },
    },
    orderBy: [{ account: { name: "asc" } }, { instrument: { symbol: "asc" } }],
  });

  const instrumentIds = [...new Set(rows.map((h) => h.instrumentId))];
  const valuationRows = instrumentIds.length
    ? await prisma.instrumentValuation.findMany({
        where: { instrumentId: { in: instrumentIds } },
        orderBy: { valuationDate: "asc" },
      })
    : [];

  const valuationIndex = new Map<number, Array<{ valuationDate: Date; price: number }>>();
  for (const row of valuationRows) {
    const points = valuationIndex.get(row.instrumentId) ?? [];
    points.push({ valuationDate: row.valuationDate, price: Number(row.price) });
    valuationIndex.set(row.instrumentId, points);
  }
  for (const points of valuationIndex.values()) {
    points.sort((a, b) => a.valuationDate.getTime() - b.valuationDate.getTime());
  }

  const positions: PortfolioPosition[] = [];

  for (const holding of rows) {
    const account = accountById.get(holding.accountId);
    if (!account) continue;

    const summary = await buildHoldingSummary(
      prisma,
      holding,
      account.currency,
      plnPerUnit,
      valuationIndex,
    );
    if (summary.quantity <= 0) continue;

    const assetBucket = inferAssetBucket(account.accountType, holding.instrument.instrumentType);

    if (filters.instrumentType) {
      const want = filters.instrumentType.toUpperCase();
      if (holding.instrument.instrumentType.toUpperCase() !== want) continue;
    }
    if (filters.assetBucket) {
      if (assetBucket !== filters.assetBucket) continue;
    }

    positions.push({
      ...summary,
      accountName: account.name,
      accountType: account.accountType,
      accountCurrency: account.currency,
      assetBucket,
    });
  }

  return positions;
}
