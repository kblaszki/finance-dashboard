import { badRequest } from "../lib/errors";
import { parseMonthParam } from "./categoryBreakdown";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export type MonthListQuery = {
  mode: "month";
  month: string;
  start: Date;
  end: Date;
};

export type CursorListQuery = {
  mode: "cursor";
  limit: number;
  beforeOccurredAt: Date | null;
  beforeId: number | null;
};

export type ListPageQuery = MonthListQuery | CursorListQuery;

export type ListPageResult<T> = {
  items: T[];
  nextCursor: string | null;
};

/** Opaque cursor: ISO instant + id, joined by `|`. */
export function encodeListCursor(occurredAt: Date, id: number): string {
  return `${occurredAt.toISOString()}|${id}`;
}

export function decodeListCursor(raw: string): { occurredAt: Date; id: number } {
  const parts = raw.split("|");
  if (parts.length !== 2) throw badRequest("cursor is invalid");
  const occurredAt = new Date(parts[0]!);
  const id = Number(parts[1]);
  if (Number.isNaN(occurredAt.getTime()) || !Number.isInteger(id) || id < 1) {
    throw badRequest("cursor is invalid");
  }
  return { occurredAt, id };
}

function parseLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_LIMIT;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest("limit must be a positive integer");
  }
  return Math.min(n, MAX_LIMIT);
}

/**
 * `month=YYYY-MM` → full month window (UTC).
 * Otherwise cursor page with `limit` + optional `cursor`.
 * Passing both month and cursor → 400.
 */
export function parseListPageQuery(query: {
  month?: unknown;
  limit?: unknown;
  cursor?: unknown;
}): ListPageQuery {
  const hasMonth =
    query.month !== undefined && query.month !== null && String(query.month).trim() !== "";
  const hasCursor =
    query.cursor !== undefined && query.cursor !== null && String(query.cursor).trim() !== "";

  if (hasMonth && hasCursor) {
    throw badRequest("month and cursor cannot be combined");
  }

  if (hasMonth) {
    const { month, start, end } = parseMonthParam(query.month);
    return { mode: "month", month, start, end };
  }

  const limit = parseLimit(query.limit);
  if (!hasCursor) {
    return { mode: "cursor", limit, beforeOccurredAt: null, beforeId: null };
  }
  const decoded = decodeListCursor(String(query.cursor).trim());
  return {
    mode: "cursor",
    limit,
    beforeOccurredAt: decoded.occurredAt,
    beforeId: decoded.id,
  };
}

/** Prisma `where` fragment for cursor pagination (desc occurredAt, id). */
export function cursorWhere(
  beforeOccurredAt: Date | null,
  beforeId: number | null,
):
  | undefined
  | {
      OR: Array<
        | { occurredAt: { lt: Date } }
        | { occurredAt: Date; id: { lt: number } }
      >;
    } {
  if (beforeOccurredAt == null || beforeId == null) return undefined;
  return {
    OR: [
      { occurredAt: { lt: beforeOccurredAt } },
      { occurredAt: beforeOccurredAt, id: { lt: beforeId } },
    ],
  };
}

export function pageResultFromRows<T extends { id: number; occurredAt: Date }>(
  rows: T[],
  limit: number,
): ListPageResult<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last ? encodeListCursor(last.occurredAt, last.id) : null;
  return { items, nextCursor };
}
