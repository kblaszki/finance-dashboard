import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { syncYahooAllowlistGaps } from "../domain/yahooHistory";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const prisma = new PrismaClient();
  try {
    const result = await syncYahooAllowlistGaps(prisma, {
      force,
      delayMs: 250,
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
