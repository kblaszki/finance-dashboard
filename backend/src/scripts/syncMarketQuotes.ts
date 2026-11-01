import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { syncWatchlistQuotes } from "../domain/marketData";
import { readArg } from "../lib/cliArgs";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main(): Promise<void> {
  const userIdRaw = readArg("--userId");
  const force = process.argv.includes("--force");
  const watchlistOnly = process.argv.includes("--watchlist-only");
  let userId: number | undefined;
  if (userIdRaw != null) {
    userId = Number(userIdRaw);
    if (!Number.isInteger(userId) || userId < 1) {
      throw new Error("--userId must be a positive integer");
    }
  }

  const prisma = new PrismaClient();
  try {
    const result = await syncWatchlistQuotes(prisma, {
      force,
      watchlistOnly,
      ...(userId != null ? { userId, watchlistOnly: true } : {}),
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
