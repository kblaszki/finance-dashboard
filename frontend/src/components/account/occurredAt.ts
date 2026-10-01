export function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function defaultOccurredAtValue(): string {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return formatDateTimeLocal(now);
}

export function shiftOccurredAtByDays(value: string, days: number): string {
  const base = new Date(value);
  if (Number.isNaN(base.getTime())) {
    return defaultOccurredAtValue();
  }
  base.setDate(base.getDate() + days);
  return formatDateTimeLocal(base);
}

export function shiftOccurredAtByHours(value: string, hours: number): string {
  const base = new Date(value);
  if (Number.isNaN(base.getTime())) {
    return defaultOccurredAtValue();
  }
  base.setHours(base.getHours() + hours);
  return formatDateTimeLocal(base);
}

function formatDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
