export type InstrumentSymbolInput = {
  symbol: string;
  exchange: string | null;
  instrumentType: string;
  currency?: string;
};

const SYNCABLE_TYPES = new Set(["STOCK", "ETF"]);

export function isSyncableInstrumentType(instrumentType: string): boolean {
  return SYNCABLE_TYPES.has(instrumentType.trim().toUpperCase());
}

export function isCryptoInstrument(accountType: string, instrumentType: string): boolean {
  return accountType === "CRYPTO" || instrumentType.trim().toUpperCase() === "CRYPTO";
}

/** Maps crypto symbol to Twelve Data pair format (e.g. BTC/USD). */
export function mapCryptoToProviderSymbol(symbol: string, currency: string): string | null {
  const base = symbol.trim().toUpperCase();
  if (!base) return null;
  if (base.includes("/")) return base;
  const quote = currency.trim().toUpperCase() || "USD";
  return `${base}/${quote}`;
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
    return `${symbol}:GPW`;
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
