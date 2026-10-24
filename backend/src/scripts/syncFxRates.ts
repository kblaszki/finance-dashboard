import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { defaultSyncRange, syncFxRates } from "../domain/fxRates";
import { utcDateFromYmd } from "../domain/fx";

dotenv.config();

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

function parseRange(): { fromYmd: string; toYmd: string } {
  const from = readArg("--from");
  const to = readArg("--to");
  const daysRaw = readArg("--days");

  if (from || to) {
    if (!from || !to) {
      throw new Error("Use both --from YYYY-MM-DD and --to YYYY-MM-DD");
    }
    utcDateFromYmd(from);
    utcDateFromYmd(to);
    if (utcDateFromYmd(from) > utcDateFromYmd(to)) {
      throw new Error("--from must be on or before --to");
    }
    return { fromYmd: from, toYmd: to };
  }

  const days = daysRaw != null ? Number(daysRaw) : 30;
  if (!Number.isInteger(days) || days < 1) {
    throw new Error("--days must be a positive integer");
  }
  return defaultSyncRange(days);
}

async function main(): Promise<void> {
  const range = parseRange();
  const prisma = new PrismaClient();
  try {
    const result = await syncFxRates(prisma, range);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        from: result.from,
        to: result.to,
        upserted: result.upserted,
        currencies: ["EUR", "USD"],
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
