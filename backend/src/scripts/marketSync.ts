import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { getFxRatesPlnPerUnit } from "../fx";
import { syncMarketPrices } from "../marketDataSync";

dotenv.config();

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const backfillDays = process.env.MARKET_BACKFILL_DAYS
    ? Number(process.env.MARKET_BACKFILL_DAYS)
    : 90;

  try {
    const result = await syncMarketPrices(prisma, getFxRatesPlnPerUnit, {
      backfillDays: Number.isFinite(backfillDays) ? backfillDays : 90,
      delayMs: 1500,
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
