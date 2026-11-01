import { isGpwListed } from "./instruments";

/** Well-known index tickers → Yahoo symbols. */
const INDEX_YAHOO: Record<string, string> = {
  SPX: "^GSPC",
  NDX: "^NDX",
  DJI: "^DJI",
  IXIC: "^IXIC",
  // Warsaw indexes use .WA on Yahoo chart (caret forms 404).
  WIG20: "WIG20.WA",
  MWIG40: "MWIG40.WA",
  WIG: "WIG.WA",
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
