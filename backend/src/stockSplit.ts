import type { Prisma, PrismaClient } from "@prisma/client";
import { toNumber } from "./accountValuation";

type DbClient = PrismaClient | Prisma.TransactionClient;

export function validateSplitRatio(ratio: number): void {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error("ratio must be a positive number");
  }
}

export async function applyStockSplit(
  db: DbClient,
  holdingId: number,
  ratio: number,
): Promise<void> {
  validateSplitRatio(ratio);
  const lots = await db.holdingLot.findMany({ where: { holdingId } });
  if (lots.length === 0) {
    throw new Error("No lots to split");
  }
  for (const lot of lots) {
    const qty = toNumber(lot.quantity);
    const qtyAfter = toNumber(lot.quantityAfter);
    const pricePerUnit = toNumber(lot.pricePerUnit);
    await db.holdingLot.update({
      where: { id: lot.id },
      data: {
        quantity: qty * ratio,
        quantityAfter: qtyAfter * ratio,
        pricePerUnit: pricePerUnit / ratio,
      },
    });
  }
}
