/** Phase 0 MVP price/FX history start (FR-010, DATA-007/008). */
export const MVP_MARKET_DATA_EPOCH = new Date(Date.UTC(2020, 0, 1));

export function defaultBackfillDays(asOf: Date = new Date()): number {
  const ms = asOf.getTime() - MVP_MARKET_DATA_EPOCH.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
