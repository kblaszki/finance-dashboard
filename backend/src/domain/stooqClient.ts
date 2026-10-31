import { badRequest } from "../lib/errors";

export const DEFAULT_STOOQ_CSV_BASE = "https://stooq.com/q/d/l/";

export type StooqFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export type StooqBar = {
  asOfYmd: string;
  close: number;
};

function csvBase(): string {
  const raw = String(process.env.STOOQ_CSV_BASE ?? DEFAULT_STOOQ_CSV_BASE).trim();
  return raw.replace(/\?.*$/, "") || DEFAULT_STOOQ_CSV_BASE;
}

/**
 * Parse Stooq daily CSV (`Date,Open,High,Low,Close,Volume`).
 * Returns newest-first or oldest-first — caller does not care; both accepted.
 */
export function parseStooqDailyCsv(csv: string): StooqBar[] {
  const lines = String(csv ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0]!.toLowerCase();
  if (!header.includes("date") || !header.includes("close")) {
    throw badRequest("Stooq CSV missing Date/Close header");
  }
  const cols = lines[0]!.split(",");
  const dateIdx = cols.findIndex((c) => c.trim().toLowerCase() === "date");
  const closeIdx = cols.findIndex((c) => c.trim().toLowerCase() === "close");
  if (dateIdx < 0 || closeIdx < 0) {
    throw badRequest("Stooq CSV missing Date or Close column");
  }
  const out: StooqBar[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i]!.split(",");
    const dateRaw = parts[dateIdx]?.trim() ?? "";
    const close = Number(parts[closeIdx]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) continue;
    if (!Number.isFinite(close) || close <= 0) continue;
    out.push({ asOfYmd: dateRaw, close });
  }
  return out;
}

/**
 * Daily history CSV from Stooq (`s=cdr` or `s=^wig20`, `i=d`).
 */
export async function fetchStooqDailyHistory(
  stooqSymbol: string,
  fetchImpl: StooqFetch = fetch,
): Promise<StooqBar[]> {
  const s = String(stooqSymbol ?? "").trim().toLowerCase();
  if (!s) throw badRequest("stooqSymbol required");
  const url = new URL(csvBase());
  url.searchParams.set("s", s);
  url.searchParams.set("i", "d");
  const res = await fetchImpl(url.toString());
  if (!res.ok) {
    throw new Error(`Stooq request failed (${res.status})`);
  }
  const text = await res.text();
  if (/^No data/i.test(text.trim()) || text.includes("<html")) {
    throw badRequest(`Stooq returned no data for ${s}`);
  }
  return parseStooqDailyCsv(text);
}
