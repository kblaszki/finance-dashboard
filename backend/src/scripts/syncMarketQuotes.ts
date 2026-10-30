import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { syncWatchlistQuotes } from "../domain/marketData";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const userIdRaw = readArg("--userId");
  const force = process.argv.includes("--force");
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
      ...(userId != null ? { userId } : {}),
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
