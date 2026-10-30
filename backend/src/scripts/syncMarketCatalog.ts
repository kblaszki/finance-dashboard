import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { syncInstrumentCatalog } from "../domain/marketData";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.error("Fetching Twelve Data stocks + etfs catalogs…");
  const prisma = new PrismaClient();
  try {
    const result = await syncInstrumentCatalog(prisma);
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
