import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest, notFound } from "../lib/errors";
import type { TwelveDataCatalogRow } from "./twelveDataClient";

export const INSTRUMENT_PROVIDER_TWELVE_DATA = "twelve_data";
export const INSTRUMENT_ASSET_CLASSES = ["STOCK", "ETF"] as const;
export type InstrumentAssetClass = (typeof INSTRUMENT_ASSET_CLASSES)[number];

const ASSET_SET = new Set<string>(INSTRUMENT_ASSET_CLASSES);

export const INSTRUMENT_SEARCH_MIN_Q = 1;
export const INSTRUMENT_SEARCH_DEFAULT_LIMIT = 25;
export const INSTRUMENT_SEARCH_MAX_LIMIT = 50;

type Db = PrismaClient | Prisma.TransactionClient;

export type InstrumentRow = {
  id: number;
  symbol: string;
  name: string;
  exchange: string;
  micCode: string | null;
  country: string | null;
  currency: string;
  assetClass: string;
  provider: string;
  providerSymbol: string;
  createdAt: Date;
  updatedAt: Date;
};

export function instrumentPayload(row: InstrumentRow) {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    micCode: row.micCode,
    country: row.country,
    currency: row.currency,
    assetClass: row.assetClass,
    provider: row.provider,
    providerSymbol: row.providerSymbol,
  };
}

export function assertAssetClass(value: unknown): InstrumentAssetClass {
  const code = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!ASSET_SET.has(code)) {
    throw badRequest(
      `assetClass must be one of: ${INSTRUMENT_ASSET_CLASSES.join(", ")}`,
    );
  }
  return code as InstrumentAssetClass;
}

export function parseOptionalAssetClass(
  value: unknown,
): InstrumentAssetClass | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return assertAssetClass(value);
}

export function parseSearchQuery(value: unknown): string {
  const q = String(value ?? "").trim();
  if (q.length < INSTRUMENT_SEARCH_MIN_Q) {
    throw badRequest(`q must be at least ${INSTRUMENT_SEARCH_MIN_Q} character(s)`);
  }
  if (q.length > 80) throw badRequest("q is too long");
  return q;
}

export function parseSearchLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return INSTRUMENT_SEARCH_DEFAULT_LIMIT;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > INSTRUMENT_SEARCH_MAX_LIMIT) {
    throw badRequest(
      `limit must be an integer from 1 to ${INSTRUMENT_SEARCH_MAX_LIMIT}`,
    );
  }
  return n;
}

export function providerSymbolForCatalog(
  row: TwelveDataCatalogRow,
): string {
  const symbol = row.symbol.trim().toUpperCase();
  const exchange = row.exchange.trim();
  // Prefer bare symbol for US; keep exchange suffix when present for disambiguation later.
  return exchange ? `${symbol}` : symbol;
}

export async function upsertCatalogInstruments(
  db: Db,
  assetClass: InstrumentAssetClass,
  rows: TwelveDataCatalogRow[],
): Promise<number> {
  let upserted = 0;
  for (const row of rows) {
    const symbol = row.symbol.trim().toUpperCase();
    if (!symbol) continue;
    const providerSymbol = providerSymbolForCatalog(row);
    const name = row.name.trim() || symbol;
    const exchange = row.exchange.trim();
    const currency = (row.currency || "USD").trim().toUpperCase() || "USD";
    await db.instrument.upsert({
      where: {
        provider_providerSymbol: {
          provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
          providerSymbol,
        },
      },
      create: {
        symbol,
        name,
        exchange,
        micCode: row.micCode,
        country: row.country,
        currency,
        assetClass,
        provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
        providerSymbol,
      },
      update: {
        symbol,
        name,
        exchange,
        micCode: row.micCode,
        country: row.country,
        currency,
        assetClass,
      },
    });
    upserted += 1;
  }
  return upserted;
}

export async function searchInstruments(
  db: Db,
  input: {
    q: string;
    assetClass?: InstrumentAssetClass;
    limit: number;
  },
): Promise<InstrumentRow[]> {
  const q = input.q.trim();
  const where: Prisma.InstrumentWhereInput = {
    OR: [
      { symbol: { contains: q } },
      { name: { contains: q } },
      { providerSymbol: { contains: q } },
    ],
  };
  if (input.assetClass) {
    where.assetClass = input.assetClass;
  }
  return db.instrument.findMany({
    where,
    orderBy: [{ symbol: "asc" }, { name: "asc" }],
    take: input.limit,
  });
}

export async function findInstrumentById(
  db: Db,
  id: number,
): Promise<InstrumentRow> {
  const row = await db.instrument.findUnique({ where: { id } });
  if (!row) throw notFound("Instrument not found");
  return row;
}
