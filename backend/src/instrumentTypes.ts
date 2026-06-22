import { badRequest } from "./routes/httpSupport";

export const INSTRUMENT_TYPES = ["STOCK", "ETF", "BOND", "FUND", "OTHER"] as const;
export type InstrumentTypeName = (typeof INSTRUMENT_TYPES)[number];

export const ALLOWED_INSTRUMENT_TYPES = new Set<string>(INSTRUMENT_TYPES);

export function parseInstrumentType(value: unknown): InstrumentTypeName {
  const type = String(value ?? "STOCK").trim().toUpperCase();
  if (!ALLOWED_INSTRUMENT_TYPES.has(type)) {
    throw badRequest(`Invalid instrumentType: ${type}`);
  }
  return type as InstrumentTypeName;
}

export function isAllowedInstrumentType(value: string): boolean {
  return ALLOWED_INSTRUMENT_TYPES.has(value.trim().toUpperCase());
}
