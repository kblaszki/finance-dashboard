import type { StatsPeriod } from "../api/statisticsApi";
import { formatPercent } from "./format";

/** Previous calendar month as YYYY-MM. */
export function shiftUtcMonth(month: string, deltaMonths: number): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const d = new Date(Date.UTC(year, monthIndex + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Anchor month for the previous stats period (same shape as Statistics page
 * anchors: month = that month; quarter = first month of quarter; year = Jan).
 */
export function previousPeriodAnchor(
  month: string,
  period: StatsPeriod,
): string {
  if (period === "month") {
    return shiftUtcMonth(month, -1);
  }
  if (period === "quarter") {
    return shiftUtcMonth(month, -3);
  }
  return shiftUtcMonth(month, -12);
}

/** Percent change current vs previous; null when previous is 0. */
export function percentDelta(
  current: number,
  previous: number,
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatPeriodDelta(
  current: number,
  previous: number,
): string {
  const delta = percentDelta(current, previous);
  if (delta == null) return "— vs prev";
  return `${formatPercent(delta, { decimals: 0, signed: true })} vs prev`;
}
