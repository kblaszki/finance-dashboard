import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  defaultAllowlistHistoryPath,
  importInstrumentHistory,
  marketHistoryDataDir,
} from "../domain/marketHistoryIo";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const fileRaw = readArg("--file") ?? readArg("--out");
  const dataDir = marketHistoryDataDir(
    path.resolve(__dirname, "../../data/market-history"),
  );
  const filePath = fileRaw
    ? path.resolve(fileRaw)
    : defaultAllowlistHistoryPath(dataDir);

  const prisma = new PrismaClient();
  try {
    const result = await importInstrumentHistory(prisma, filePath);
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
