import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { syncAllowlistHistory } from "../domain/marketHistory";
import { marketUniverseDir } from "../domain/marketUniverse";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const instrumentIdRaw = readArg("--instrumentId");
  let instrumentId: number | undefined;
  if (instrumentIdRaw != null) {
    instrumentId = Number(instrumentIdRaw);
    if (!Number.isInteger(instrumentId) || instrumentId < 1) {
      throw new Error("--instrumentId must be a positive integer");
    }
  }

  const prisma = new PrismaClient();
  try {
    const result = await syncAllowlistHistory(prisma, {
      force,
      universeDir: marketUniverseDir(
        path.resolve(__dirname, "../../data/market-universe"),
      ),
      ...(instrumentId != null ? { instrumentId } : {}),
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
