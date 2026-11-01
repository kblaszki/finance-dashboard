import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { syncYahooHistory } from "../domain/yahooHistory";
import { readArg } from "../lib/cliArgs";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const watchlistOnly = process.argv.includes("--watchlist-only");
  const instrumentIdRaw = readArg("--instrumentId");
  const userIdRaw = readArg("--userId");
  const range = readArg("--range") ?? "1y";

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

  if (watchlistOnly && userId == null) {
    // Default: first user with any watchlist items
    const prismaProbe = new PrismaClient();
    try {
      const item = await prismaProbe.watchlistItem.findFirst({
        orderBy: { userId: "asc" },
        select: { userId: true },
      });
      if (!item) {
        throw new Error("No watchlist items found (pass --userId=N)");
      }
      userId = item.userId;
      // eslint-disable-next-line no-console
      console.log(`Using watchlist for userId=${userId}`);
    } finally {
      await prismaProbe.$disconnect();
    }
  }

  const prisma = new PrismaClient();
  try {
    const result = await syncYahooHistory(prisma, {
      force,
      delayMs: 250,
      range,
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
