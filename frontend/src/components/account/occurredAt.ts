const DATE_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Display an ISO instant as a local calendar date (no time). */
export function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

/** Today's date as `YYYY-MM-DD` for `<input type="date">`. */
export function defaultOccurredAtValue(): string {
  return formatDateLocal(new Date());
}

export function shiftOccurredAtByDays(value: string, days: number): string {
  const base = parseDateInput(value) ?? new Date();
  base.setDate(base.getDate() + days);
  return formatDateLocal(base);
}

export function formatDateLocal(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Convert an ISO instant to a `date` input value (local calendar day). */
export function toDateLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return defaultOccurredAtValue();
  return formatDateLocal(d);
}

/**
 * Parse a `YYYY-MM-DD` (or other parseable) date input and return an ISO instant
 * at local noon so day-precision stats stay on the intended calendar day.
 */
export function dateInputToIso(value: string): string {
  const local = parseDateInput(value);
  if (!local) {
    throw new Error("Invalid date");
  }
  return local.toISOString();
}

function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  const match = DATE_INPUT_RE.exec(trimmed);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const d = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      d.getFullYear() !== year ||
      d.getMonth() !== month - 1 ||
      d.getDate() !== day
    ) {
      return null;
    }
    return d;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(12, 0, 0, 0);
  return d;
}
