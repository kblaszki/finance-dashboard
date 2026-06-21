export type InstrumentSymbolInput = {
  symbol: string;
  exchange: string | null;
  instrumentType: string;
};

const SYNCABLE_TYPES = new Set(["STOCK", "ETF"]);

export function isSyncableInstrumentType(instrumentType: string): boolean {
  return SYNCABLE_TYPES.has(instrumentType.trim().toUpperCase());
}

/** Maps internal instrument metadata to a Twelve Data symbol (MIC suffix when needed). */
export function mapInstrumentToProviderSymbol(instrument: InstrumentSymbolInput): string | null {
  const symbol = instrument.symbol.trim().toUpperCase();
  if (!symbol) return null;

  const type = instrument.instrumentType.trim().toUpperCase();
  if (!isSyncableInstrumentType(type)) return null;

  const exchange = (instrument.exchange ?? "").trim().toUpperCase();

  if (!exchange || exchange === "NASDAQ" || exchange === "NYSE" || exchange === "AMEX" || exchange === "US") {
    return symbol;
  }

  if (exchange === "GPW" || exchange === "WAR" || exchange === "WSE" || exchange === "NEWCONNECT") {
    return `${symbol}:WAR`;
  }

  if (exchange === "XETRA" || exchange === "XETR" || exchange === "FWB") {
    return `${symbol}:XETR`;
  }

  if (exchange === "LSE" || exchange === "LON") {
    return `${symbol}:LSE`;
  }

  if (exchange === "EURONEXT" || exchange === "PAR") {
    return `${symbol}:XPAR`;
  }

  return null;
}
