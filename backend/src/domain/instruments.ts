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

const GPW_EXCHANGES = new Set(["GPW", "WSE"]);

/** True when quotes should use Oanor GPW (not Twelve Data). */
export function isGpwListed(instrument: {
  exchange?: string | null;
  country?: string | null;
}): boolean {
  const exchange = String(instrument.exchange ?? "")
    .trim()
    .toUpperCase();
  if (GPW_EXCHANGES.has(exchange)) return true;
  const country = String(instrument.country ?? "")
    .trim()
    .toLowerCase();
  return country === "poland";
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

const CATALOG_UPSERT_BATCH = 500;

type CatalogWriteRow = {
  symbol: string;
  name: string;
  exchange: string;
  micCode: string | null;
  country: string | null;
  currency: string;
  assetClass: InstrumentAssetClass;
  provider: string;
  providerSymbol: string;
};

function catalogWriteRows(
  assetClass: InstrumentAssetClass,
  rows: TwelveDataCatalogRow[],
): CatalogWriteRow[] {
  const out: CatalogWriteRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const symbol = row.symbol.trim().toUpperCase();
    if (!symbol) continue;
    const providerSymbol = providerSymbolForCatalog(row);
    if (seen.has(providerSymbol)) continue;
    seen.add(providerSymbol);
    out.push({
      symbol,
      name: row.name.trim() || symbol,
      exchange: row.exchange.trim(),
      micCode: row.micCode,
      country: row.country,
      currency: (row.currency || "USD").trim().toUpperCase() || "USD",
      assetClass,
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol,
    });
  }
  return out;
}

/**
 * Bulk-insert catalog rows in batches. Existing (provider, providerSymbol) rows
 * are left unchanged (SQLite Prisma client has no createMany skipDuplicates).
 * Prefer this over per-row upsert — full Twelve Data lists are huge.
 */
export async function upsertCatalogInstruments(
  db: Db,
  assetClass: InstrumentAssetClass,
  rows: TwelveDataCatalogRow[],
): Promise<number> {
  const prepared = catalogWriteRows(assetClass, rows);
  if (prepared.length === 0) return 0;

  // Unique is (provider, providerSymbol) across STOCK/ETF — do not scope by assetClass.
  const existing = await db.instrument.findMany({
    where: { provider: INSTRUMENT_PROVIDER_TWELVE_DATA },
    select: { providerSymbol: true },
  });
  const have = new Set(existing.map((r) => r.providerSymbol));
  const toCreate = prepared.filter((r) => !have.has(r.providerSymbol));

  for (let i = 0; i < toCreate.length; i += CATALOG_UPSERT_BATCH) {
    const batch = toCreate.slice(i, i + CATALOG_UPSERT_BATCH);
    await db.instrument.createMany({ data: batch });
  }

  return prepared.length;
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
