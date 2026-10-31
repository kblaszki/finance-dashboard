import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import {
  INSTRUMENT_ASSET_CLASSES,
  INSTRUMENT_PROVIDER_TWELVE_DATA,
  type InstrumentAssetClass,
} from "./instruments";

export type UniverseSeedRow = {
  symbol: string;
  name: string;
  assetClass: string;
  exchange?: string;
  country?: string | null;
  currency?: string;
  providerSymbol?: string;
  stooqSymbol?: string;
  historySource?: "twelve_data" | "stooq" | string;
};

export type SeedUniverseResult = {
  files: string[];
  upserted: number;
  created: number;
  updated: number;
  warnings: string[];
};

const ASSET_SET = new Set<string>([...INSTRUMENT_ASSET_CLASSES, "INDEX"]);

const UNIVERSE_FILES = [
  "sp500.json",
  "gpw-wig20-mwig40.json",
  "indices.json",
  "etfs.json",
] as const;

export function marketUniverseDir(
  fromDir: string = path.resolve(__dirname, "../../data/market-universe"),
): string {
  return fromDir;
}

export function loadUniverseSeedRows(
  dir: string = marketUniverseDir(),
): { rows: UniverseSeedRow[]; files: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const rows: UniverseSeedRow[] = [];
  const files: string[] = [];
  for (const file of UNIVERSE_FILES) {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) {
      warnings.push(`Missing universe file: ${file}`);
      continue;
    }
    files.push(file);
    const raw = JSON.parse(fs.readFileSync(full, "utf8")) as unknown;
    if (!Array.isArray(raw)) {
      warnings.push(`${file} is not a JSON array`);
      continue;
    }
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as UniverseSeedRow;
      const symbol = String(row.symbol ?? "").trim().toUpperCase();
      if (!symbol) continue;
      const assetClass = String(row.assetClass ?? "STOCK")
        .trim()
        .toUpperCase();
      if (!ASSET_SET.has(assetClass)) {
        warnings.push(`${file}: skip ${symbol} bad assetClass=${assetClass}`);
        continue;
      }
      rows.push({
        ...row,
        symbol,
        name: String(row.name ?? symbol).trim() || symbol,
        assetClass,
        providerSymbol: String(row.providerSymbol ?? symbol)
          .trim()
          .toUpperCase(),
        exchange: String(row.exchange ?? "").trim(),
        country: row.country == null ? null : String(row.country).trim(),
        currency: String(row.currency ?? "USD").trim().toUpperCase() || "USD",
        stooqSymbol: row.stooqSymbol
          ? String(row.stooqSymbol).trim().toLowerCase()
          : undefined,
        historySource: row.historySource,
      });
    }
  }
  return { rows, files, warnings };
}

/** Lookup map providerSymbol -> seed row (last wins). */
export function universeByProviderSymbol(
  rows: UniverseSeedRow[],
): Map<string, UniverseSeedRow> {
  const map = new Map<string, UniverseSeedRow>();
  for (const row of rows) {
    const key = String(row.providerSymbol ?? row.symbol).toUpperCase();
    map.set(key, row);
  }
  return map;
}

export async function seedMarketUniverse(
  prisma: PrismaClient,
  dir: string = marketUniverseDir(),
): Promise<SeedUniverseResult> {
  const { rows, files, warnings } = loadUniverseSeedRows(dir);
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const providerSymbol = String(row.providerSymbol ?? row.symbol).toUpperCase();
    const assetClass = row.assetClass as InstrumentAssetClass | "INDEX";
    const existing = await prisma.instrument.findUnique({
      where: {
        provider_providerSymbol: {
          provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
          providerSymbol,
        },
      },
    });
    if (!existing) {
      await prisma.instrument.create({
        data: {
          symbol: row.symbol,
          name: row.name,
          exchange: row.exchange ?? "",
          country: row.country ?? null,
          currency: row.currency ?? "USD",
          assetClass,
          provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
          providerSymbol,
          allowlisted: true,
        },
      });
      created += 1;
      continue;
    }
    await prisma.instrument.update({
      where: { id: existing.id },
      data: {
        allowlisted: true,
        name: row.name || existing.name,
        ...(row.exchange ? { exchange: row.exchange } : {}),
        ...(row.country != null ? { country: row.country } : {}),
        ...(row.currency ? { currency: row.currency } : {}),
        assetClass,
        symbol: row.symbol || existing.symbol,
      },
    });
    updated += 1;
  }

  return {
    files,
    upserted: created + updated,
    created,
    updated,
    warnings,
  };
}
