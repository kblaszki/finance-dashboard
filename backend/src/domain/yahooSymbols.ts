import { isGpwListed } from "./instruments";

/** Well-known index tickers → Yahoo symbols. */
const INDEX_YAHOO: Record<string, string> = {
  SPX: "^GSPC",
  NDX: "^NDX",
  DJI: "^DJI",
  IXIC: "^IXIC",
  WIG20: "^WIG20",
  MWIG40: "^MWIG40",
  WIG: "^WIG",
};

/**
 * Map a local Instrument row to a Yahoo Finance chart symbol.
 */
export function yahooSymbolForInstrument(instrument: {
  symbol: string;
  providerSymbol?: string | null;
  assetClass?: string | null;
  exchange?: string | null;
  country?: string | null;
}): string {
  const symbol = String(instrument.symbol ?? "").trim().toUpperCase();
  const assetClass = String(instrument.assetClass ?? "")
    .trim()
    .toUpperCase();

  if (assetClass === "INDEX" && INDEX_YAHOO[symbol]) {
    return INDEX_YAHOO[symbol]!;
  }

  if (isGpwListed(instrument)) {
    const base = symbol.replace(/\.WA$/i, "");
    return `${base}.WA`;
  }

  const provider = String(instrument.providerSymbol ?? symbol)
    .trim()
    .toUpperCase();
  return provider || symbol;
}
