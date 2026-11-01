import { Prisma, type Holding, type PrismaClient } from "@prisma/client";
import { badRequest } from "../lib/errors";

type Db = PrismaClient | Prisma.TransactionClient;

export const ASSET_TRADE_ACCOUNT_TYPES = ["BROKERAGE", "IKE", "IKZE"] as const;

export type AssetTradeAccountType = (typeof ASSET_TRADE_ACCOUNT_TYPES)[number];

const ELIGIBLE = new Set<string>(ASSET_TRADE_ACCOUNT_TYPES);

export function isAssetTradeAccountType(accountType: string): boolean {
  return ELIGIBLE.has(String(accountType).trim().toUpperCase());
}

export function assertAssetTradeAccountType(accountType: string): void {
  if (!isAssetTradeAccountType(accountType)) {
    throw badRequest(
      `asset trades require accountType one of: ${ASSET_TRADE_ACCOUNT_TYPES.join(", ")}`,
    );
  }
}

/** Find or create the holding row for (account, instrument). */
export async function resolveHolding(
  db: Db,
  accountId: number,
  instrumentId: number,
): Promise<Holding> {
  const existing = await db.holding.findUnique({
    where: {
      accountId_instrumentId: { accountId, instrumentId },
    },
  });
  if (existing) return existing;
  return db.holding.create({
    data: { accountId, instrumentId, quantity: 0 },
  });
}

/** Recompute Holding.quantity from open lots. */
export async function syncHoldingQuantity(
  db: Db,
  holdingId: number,
): Promise<Holding> {
  const lots = await db.lot.findMany({
    where: { holdingId, quantityOpen: { gt: 0 } },
    select: { quantityOpen: true },
  });
  const qty = lots.reduce(
    (sum, lot) => sum.add(lot.quantityOpen),
    new Prisma.Decimal(0),
  );
  return db.holding.update({
    where: { id: holdingId },
    data: { quantity: qty },
  });
}
