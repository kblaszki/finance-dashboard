import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  marketUniverseDir,
  seedMarketUniverse,
} from "../domain/marketUniverse";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main(): Promise<void> {
  const dir = marketUniverseDir(path.resolve(__dirname, "../../data/market-universe"));
  // eslint-disable-next-line no-console
  console.error(`Seeding market universe from ${dir}`);
  const prisma = new PrismaClient();
  try {
    const result = await seedMarketUniverse(prisma, dir);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result));
    for (const w of result.warnings) {
      // eslint-disable-next-line no-console
      console.error(`warning: ${w}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
