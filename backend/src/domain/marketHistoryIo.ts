import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { PrismaClient } from "@prisma/client";
import { badRequest } from "../lib/errors";
import { formatYmdUtc } from "./fx";
import {
  INSTRUMENT_PROVIDER_TWELVE_DATA,
} from "./instruments";
import { upsertInstrumentClose } from "./instrumentValuations";

export type HistoryNdjsonRow = {
  provider: string;
  providerSymbol: string;
  asOf: string;
  close: number;
  source: string;
};

export type ExportHistoryOptions = {
  instrumentId?: number;
  userId?: number;
  /** Keep only last N calendar months (by asOf). */
  months?: number;
  /** One bar per YYYY-MM (latest asOf in that month). */
  monthly?: boolean;
  /** Absolute or relative output path. */
  filePath: string;
};

export type ExportHistoryResult = {
  filePath: string;
  instruments: number;
  rowsWritten: number;
};

export type ImportHistoryResult = {
  rowsRead: number;
  upserted: number;
  skippedUnknownInstrument: number;
  warnings: string[];
};

export function marketHistoryDataDir(
  fromDir: string = path.resolve(__dirname, "../../data/market-history"),
): string {
  return fromDir;
}

/** Local full allowlist dump (gitignored). */
export const DEFAULT_ALLOWLIST_EXPORT_NAME = "allowlist-eod.ndjson.gz";

/** Favorites attached to the demo user when seeding Markets. */
export const DEMO_MARKET_WATCHLIST_SYMBOLS = [
  "AAPL",
  "VOO",
  "SPX",
  "XTB",
  "ETFBW20TR",
] as const;

export function marketHistoryExportsDir(
  dir: string = marketHistoryDataDir(),
): string {
  return path.join(dir, "exports");
}

export function defaultAllowlistHistoryPath(
  dir: string = marketHistoryDataDir(),
): string {
  return path.join(marketHistoryExportsDir(dir), DEFAULT_ALLOWLIST_EXPORT_NAME);
}

export function demoHistoryFixturePath(
  dir: string = marketHistoryDataDir(),
): string {
  return path.join(dir, "demo-eod.ndjson");
}

export type DemoHistorySourceKind = "local-export" | "committed-fixture" | "missing";

export type DemoHistorySource = {
  path: string;
  kind: DemoHistorySourceKind;
};

/**
 * Prefer local exports/allowlist-eod.ndjson.gz when present; else committed demo-eod.ndjson.
 */
export function resolveDemoHistorySource(
  dir: string = marketHistoryDataDir(),
): DemoHistorySource {
  const localExport = defaultAllowlistHistoryPath(dir);
  if (fs.existsSync(localExport)) {
    return { path: localExport, kind: "local-export" };
  }
  const fixture = demoHistoryFixturePath(dir);
  if (fs.existsSync(fixture)) {
    return { path: fixture, kind: "committed-fixture" };
  }
  return { path: fixture, kind: "missing" };
}

export function serializeHistoryNdjsonRow(row: HistoryNdjsonRow): string {
  return JSON.stringify({
    provider: row.provider,
    providerSymbol: row.providerSymbol,
    asOf: row.asOf,
    close: row.close,
    source: row.source,
  });
}

export function parseHistoryNdjsonLine(line: string): HistoryNdjsonRow | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    throw badRequest(`Invalid NDJSON line: ${trimmed.slice(0, 80)}`);
  }
  if (!obj || typeof obj !== "object") {
    throw badRequest("NDJSON row must be an object");
  }
  const rec = obj as Record<string, unknown>;
  const provider = String(rec.provider ?? INSTRUMENT_PROVIDER_TWELVE_DATA).trim();
  const providerSymbol = String(rec.providerSymbol ?? "")
    .trim()
    .toUpperCase();
  const asOf = String(rec.asOf ?? "").trim();
  const close = Number(rec.close);
  const source = String(rec.source ?? "yahoo").trim() || "yahoo";
  if (!providerSymbol) throw badRequest("providerSymbol required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw badRequest(`Invalid asOf: ${asOf}`);
  }
  if (!Number.isFinite(close) || close <= 0) {
    throw badRequest(`Invalid close for ${providerSymbol} ${asOf}`);
  }
  return { provider, providerSymbol, asOf, close, source };
}

export function parseHistoryNdjson(text: string): HistoryNdjsonRow[] {
  const out: HistoryNdjsonRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const row = parseHistoryNdjsonLine(line);
    if (row) out.push(row);
  }
  return out;
}

/** Keep rows with asOf >= (todayUTC − months). */
export function filterHistoryByMonths(
  rows: HistoryNdjsonRow[],
  months: number,
  now: Date = new Date(),
): HistoryNdjsonRow[] {
  if (!Number.isInteger(months) || months < 1) {
    throw badRequest("months must be a positive integer");
  }
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const from = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - months, to.getUTCDate()),
  );
  const fromYmd = formatYmdUtc(from);
  return rows.filter((r) => r.asOf >= fromYmd);
}

/**
 * One row per (provider, providerSymbol, YYYY-MM) — the latest asOf in that month.
 */
export function downsampleHistoryMonthly(
  rows: HistoryNdjsonRow[],
): HistoryNdjsonRow[] {
  const best = new Map<string, HistoryNdjsonRow>();
  for (const row of rows) {
    const ym = row.asOf.slice(0, 7);
    const key = `${row.provider}\0${row.providerSymbol}\0${ym}`;
    const prev = best.get(key);
    if (!prev || row.asOf > prev.asOf) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => {
    const c = a.providerSymbol.localeCompare(b.providerSymbol);
    if (c !== 0) return c;
    return a.asOf < b.asOf ? -1 : a.asOf > b.asOf ? 1 : 0;
  });
}

function writeNdjsonFile(filePath: string, rows: HistoryNdjsonRow[]): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const body =
    rows.map(serializeHistoryNdjsonRow).join("\n") + (rows.length ? "\n" : "");
  if (filePath.endsWith(".gz")) {
    fs.writeFileSync(filePath, zlib.gzipSync(Buffer.from(body, "utf8")));
  } else {
    fs.writeFileSync(filePath, body, "utf8");
  }
}

export function readHistoryNdjsonFile(filePath: string): HistoryNdjsonRow[] {
  const raw = fs.readFileSync(filePath);
  const text = filePath.endsWith(".gz")
    ? zlib.gunzipSync(raw).toString("utf8")
    : raw.toString("utf8");
  return parseHistoryNdjson(text);
}

export async function exportInstrumentHistory(
  prisma: PrismaClient,
  options: ExportHistoryOptions,
): Promise<ExportHistoryResult> {
  let instrumentFilter: { id?: number; allowlisted?: boolean } = {
    allowlisted: true,
  };
  if (options.instrumentId != null) {
    instrumentFilter = { id: options.instrumentId };
  } else if (options.userId != null) {
    const items = await prisma.watchlistItem.findMany({
      where: { userId: options.userId },
      select: { instrumentId: true },
    });
    const ids = items.map((i) => i.instrumentId);
    const instruments = await prisma.instrument.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        provider: true,
        providerSymbol: true,
      },
    });
    return exportForInstruments(prisma, instruments, options);
  }

  const instruments = await prisma.instrument.findMany({
    where: instrumentFilter,
    select: {
      id: true,
      provider: true,
      providerSymbol: true,
    },
    orderBy: { providerSymbol: "asc" },
  });
  return exportForInstruments(prisma, instruments, options);
}

async function exportForInstruments(
  prisma: PrismaClient,
  instruments: Array<{
    id: number;
    provider: string;
    providerSymbol: string;
  }>,
  options: ExportHistoryOptions,
): Promise<ExportHistoryResult> {
  const byId = new Map(
    instruments.map((i) => [
      i.id,
      { provider: i.provider, providerSymbol: i.providerSymbol },
    ]),
  );
  const ids = instruments.map((i) => i.id);
  if (ids.length === 0) {
    writeNdjsonFile(options.filePath, []);
    return { filePath: options.filePath, instruments: 0, rowsWritten: 0 };
  }

  const valuations = await prisma.instrumentValuation.findMany({
    where: { instrumentId: { in: ids } },
    orderBy: [{ instrumentId: "asc" }, { asOfDate: "asc" }],
    select: {
      instrumentId: true,
      asOfDate: true,
      close: true,
      source: true,
    },
  });

  let rows: HistoryNdjsonRow[] = [];
  for (const v of valuations) {
    const meta = byId.get(v.instrumentId);
    if (!meta) continue;
    rows.push({
      provider: meta.provider,
      providerSymbol: meta.providerSymbol,
      asOf: formatYmdUtc(v.asOfDate),
      close: Number(v.close),
      source: v.source,
    });
  }

  if (options.months != null) {
    rows = filterHistoryByMonths(rows, options.months);
  }
  if (options.monthly === true) {
    rows = downsampleHistoryMonthly(rows);
  }

  writeNdjsonFile(options.filePath, rows);
  return {
    filePath: options.filePath,
    instruments: instruments.length,
    rowsWritten: rows.length,
  };
}

export async function importInstrumentHistory(
  prisma: PrismaClient,
  filePath: string,
): Promise<ImportHistoryResult> {
  const rows = readHistoryNdjsonFile(filePath);
  let upserted = 0;
  let skippedUnknownInstrument = 0;
  const warnings: string[] = [];
  const missing = new Set<string>();

  for (const row of rows) {
    const instrument = await prisma.instrument.findUnique({
      where: {
        provider_providerSymbol: {
          provider: row.provider,
          providerSymbol: row.providerSymbol,
        },
      },
      select: { id: true },
    });
    if (!instrument) {
      skippedUnknownInstrument += 1;
      const key = `${row.provider}:${row.providerSymbol}`;
      if (!missing.has(key)) {
        missing.add(key);
        warnings.push(`Unknown instrument ${key} — skipped`);
      }
      continue;
    }
    await upsertInstrumentClose(prisma, {
      instrumentId: instrument.id,
      asOfYmd: row.asOf,
      close: row.close,
      source: row.source,
    });
    upserted += 1;
  }

  return {
    rowsRead: rows.length,
    upserted,
    skippedUnknownInstrument,
    warnings,
  };
}

/** Distinct providerSymbols referenced in a fixture (for demo watchlist). */
export function uniqueProviderSymbolsFromHistory(
  rows: HistoryNdjsonRow[],
): string[] {
  const set = new Set<string>();
  for (const r of rows) set.add(r.providerSymbol);
  return [...set].sort();
}
