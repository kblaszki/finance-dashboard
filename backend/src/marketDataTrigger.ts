import type { PrismaClient } from "@prisma/client";
import { syncMarketPrices } from "./marketDataSync";
import { isSyncableInstrumentType } from "./marketDataSymbols";

type FxLoader = () => Promise<{ plnPerUnit: Record<string, number> }>;

export function scheduleMarketSyncAfterBuy(
  prisma: PrismaClient,
  getFxRatesPlnPerUnit: FxLoader,
  opts: { userId: number; instrumentType: string },
): void {
  if (!process.env.MARKET_DATA_API_KEY) return;
  if (!isSyncableInstrumentType(opts.instrumentType)) return;

  void syncMarketPrices(prisma, getFxRatesPlnPerUnit, { userId: opts.userId }).catch(() => {
    /* best-effort background sync */
  });
}
