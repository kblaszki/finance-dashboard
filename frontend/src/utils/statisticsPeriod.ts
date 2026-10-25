export function currentUtcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function yearOf(month: string): number {
  return Number(month.slice(0, 4));
}

export function monthIndexOf(month: string): number {
  return Number(month.slice(5, 7)) - 1;
}

export function quarterOf(month: string): number {
  return Math.floor(monthIndexOf(month) / 3) + 1;
}

export function anchorForQuarter(year: number, quarter: number): string {
  const startMonth = (quarter - 1) * 3 + 1;
  return `${year}-${String(startMonth).padStart(2, "0")}`;
}

export function anchorForYear(year: number): string {
  return `${year}-01`;
}

export const YEAR_OPTIONS = (() => {
  const current = new Date().getUTCFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - 10; y -= 1) years.push(y);
  return years;
})();
