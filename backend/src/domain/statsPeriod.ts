import { badRequest } from "../lib/errors";
import { parseMonthParam } from "./categoryBreakdown";

export const STATS_PERIODS = ["month", "quarter", "year"] as const;
export type StatsPeriodKind = (typeof STATS_PERIODS)[number];

export type StatsPeriod = {
  period: StatsPeriodKind;
  /** Anchor month (YYYY-MM) from the query. */
  month: string;
  label: string;
  start: Date;
  end: Date;
  /** Last calendar month included in the period (YYYY-MM). */
  endMonth: string;
};

export function parsePeriodParam(value: unknown): StatsPeriodKind {
  if (value === undefined || value === null || value === "") {
    return "month";
  }
  const period = String(value).trim().toLowerCase();
  if (!(STATS_PERIODS as readonly string[]).includes(period)) {
    throw badRequest("period must be month, quarter, or year");
  }
  return period as StatsPeriodKind;
}

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/**
 * Expand `month=YYYY-MM` + `period=month|quarter|year` into UTC `[start, end)`.
 * Quarter/year are calendar bounds containing the anchor month.
 */
export function parseStatsPeriod(monthValue: unknown, periodValue: unknown): StatsPeriod {
  const { month } = parseMonthParam(monthValue);
  const period = parsePeriodParam(periodValue);
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;

  if (period === "month") {
    const start = new Date(Date.UTC(year, monthIndex, 1));
    const end = new Date(Date.UTC(year, monthIndex + 1, 1));
    return { period, month, label: month, start, end, endMonth: month };
  }

  if (period === "quarter") {
    const quarterIndex = Math.floor(monthIndex / 3);
    const startMonth = quarterIndex * 3;
    const start = new Date(Date.UTC(year, startMonth, 1));
    const end = new Date(Date.UTC(year, startMonth + 3, 1));
    const endMonth = monthKey(year, startMonth + 2);
    const label = `${year} Q${quarterIndex + 1}`;
    return { period, month, label, start, end, endMonth };
  }

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return {
    period,
    month,
    label: String(year),
    start,
    end,
    endMonth: monthKey(year, 11),
  };
}
