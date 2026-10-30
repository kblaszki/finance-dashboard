import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { syncInstrumentCatalog } from "../domain/marketData";

dotenv.config();

async function main(): Promise<void> {
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
