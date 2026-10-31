import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  defaultAllowlistHistoryPath,
  exportInstrumentHistory,
  marketHistoryDataDir,
} from "../domain/marketHistoryIo";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const monthly = process.argv.includes("--monthly");
  const monthsRaw = readArg("--months");
  const outRaw = readArg("--out") ?? readArg("--file");
  const instrumentIdRaw = readArg("--instrumentId");
  const userIdRaw = readArg("--userId");
  const watchlistOnly = process.argv.includes("--watchlist-only");

  let months: number | undefined;
  if (monthsRaw != null) {
    months = Number(monthsRaw);
    if (!Number.isInteger(months) || months < 1) {
      throw new Error("--months must be a positive integer");
    }
  }

  let instrumentId: number | undefined;
  if (instrumentIdRaw != null) {
    instrumentId = Number(instrumentIdRaw);
    if (!Number.isInteger(instrumentId) || instrumentId < 1) {
      throw new Error("--instrumentId must be a positive integer");
    }
  }

  let userId: number | undefined;
  if (userIdRaw != null) {
    userId = Number(userIdRaw);
    if (!Number.isInteger(userId) || userId < 1) {
      throw new Error("--userId must be a positive integer");
    }
  }

  const prisma = new PrismaClient();
  try {
    if (watchlistOnly && userId == null) {
      const item = await prisma.watchlistItem.findFirst({
        orderBy: { userId: "asc" },
        select: { userId: true },
      });
      if (!item) throw new Error("No watchlist items (pass --userId=N)");
      userId = item.userId;
      // eslint-disable-next-line no-console
      console.log(`Using watchlist for userId=${userId}`);
    }

    const dataDir = marketHistoryDataDir(
      path.resolve(__dirname, "../../data/market-history"),
    );
    const filePath = outRaw
      ? path.resolve(outRaw)
      : defaultAllowlistHistoryPath(dataDir);

    const result = await exportInstrumentHistory(prisma, {
      filePath,
      monthly,
      ...(months != null ? { months } : {}),
      ...(instrumentId != null ? { instrumentId } : {}),
      ...(userId != null ? { userId } : {}),
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
