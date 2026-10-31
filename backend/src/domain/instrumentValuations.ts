import { Prisma, type PrismaClient } from "@prisma/client";
import { formatYmdUtc, utcDateFromYmd } from "./fx";

export const VALUATION_SOURCE_TWELVE_DATA = "twelve_data";
export const VALUATION_SOURCE_OANOR_GPW = "oanor_gpw";

type Db = PrismaClient | Prisma.TransactionClient;

export type InstrumentValuationRow = {
  id: number;
  instrumentId: number;
  asOfDate: Date;
  close: Prisma.Decimal;
  source: string;
  createdAt: Date;
};

/** True if asOfDate is today or yesterday UTC (good enough “fresh EOD” for hobby). */
export function isValuationFresh(
  asOfDate: Date,
  now: Date = new Date(),
): boolean {
  const today = formatYmdUtc(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  );
  const yesterdayDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  const yesterday = formatYmdUtc(yesterdayDate);
  const ymd = formatYmdUtc(asOfDate);
  return ymd === today || ymd === yesterday;
}

/**
 * Latest valuation for an instrument. When `source` is omitted, returns the
 * newest row across providers (Twelve Data, Oanor GPW, …).
 */
export async function getLatestValuation(
  db: Db,
  instrumentId: number,
  source?: string,
): Promise<InstrumentValuationRow | null> {
  return db.instrumentValuation.findFirst({
    where: {
      instrumentId,
      ...(source != null ? { source } : {}),
    },
    orderBy: { asOfDate: "desc" },
  });
}

export async function upsertInstrumentClose(
  db: Db,
  input: {
    instrumentId: number;
    asOfYmd: string;
    close: number | string | Prisma.Decimal;
    source?: string;
  },
): Promise<InstrumentValuationRow> {
  const asOfDate = utcDateFromYmd(input.asOfYmd);
  const close =
    input.close instanceof Prisma.Decimal
      ? input.close
      : new Prisma.Decimal(String(input.close));
  const source = input.source ?? VALUATION_SOURCE_TWELVE_DATA;
  return db.instrumentValuation.upsert({
    where: {
      instrumentId_asOfDate_source: {
        instrumentId: input.instrumentId,
        asOfDate,
        source,
      },
    },
    create: {
      instrumentId: input.instrumentId,
      asOfDate,
      close,
      source,
    },
    update: { close },
  });
}
