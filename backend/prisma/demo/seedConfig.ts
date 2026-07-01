export const DEMO_EMAIL = "demo@finance.local";
export const DEMO_USERNAME = "demo";
export const DEMO_PASSWORD = "demo12345";

export const DEMO_HISTORY_DAYS = 730;
export const SEED_MARKET_OUTPUTSIZE = 500;
/** Twelve Data free tier: 8 API credits/minute — stay under with ~8s between symbols. */
export const SEED_API_DELAY_MS = 8_000;

export type DemoInstrumentSpec = {
  instrumentType: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  /** Override when exchange MIC suffix is paid-tier only but bare symbol works. */
  providerSymbol?: string;
};

export const GPW_INSTRUMENTS: DemoInstrumentSpec[] = [
  { instrumentType: "STOCK", symbol: "PKO", name: "PKO BP", exchange: "GPW", currency: "PLN" },
];

export const US_INSTRUMENTS: DemoInstrumentSpec[] = [
  { instrumentType: "STOCK", symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", currency: "USD" },
  { instrumentType: "STOCK", symbol: "MSFT", name: "Microsoft Corp.", exchange: "NASDAQ", currency: "USD" },
  { instrumentType: "ETF", symbol: "VT", name: "Vanguard Total World Stock ETF", exchange: "NYSE", currency: "USD" },
  { instrumentType: "ETF", symbol: "VOO", name: "Vanguard S&P 500 ETF", exchange: "NYSE", currency: "USD" },
];

export const EU_INSTRUMENTS: DemoInstrumentSpec[] = [
  { instrumentType: "STOCK", symbol: "ASML", name: "ASML Holding", exchange: "AEX", currency: "EUR", providerSymbol: "ASML" },
  { instrumentType: "STOCK", symbol: "SAP", name: "SAP SE", exchange: "XETRA", currency: "EUR", providerSymbol: "SAP" },
  { instrumentType: "STOCK", symbol: "NVO", name: "Novo Nordisk", exchange: "NYSE", currency: "EUR", providerSymbol: "NVO" },
];

export const IKZE_INSTRUMENTS: DemoInstrumentSpec[] = [
  { instrumentType: "ETF", symbol: "VT", name: "Vanguard Total World Stock ETF", exchange: "NYSE", currency: "USD" },
];

export const GOLD_PROVIDER_SYMBOL = "XAU/USD";
export const GOLD_INSTRUMENT = {
  symbol: "XAU",
  name: "Gold spot",
  exchange: "COMEX",
  instrumentType: "GOLD",
  currency: "USD",
} as const;

export const METAL_GRAMS = 31.1;
export const TROY_OZ_GRAMS = 31.1034768;

export const BROKERAGE_TRADES_PER_INSTRUMENT = 14;
export const BANK_HISTORY_MONTHS = 24;

/** Net salary range per month (PLN). */
export const DEMO_SALARY_BASE_PLN = 11_000;
export const DEMO_SALARY_STEP_PLN = 1_000;
export const DEMO_SALARY_VARIETY = 9;

/** Target monthly household expenses (PLN). */
export const DEMO_MONTHLY_EXPENSE_PLN = 5_500;

/** Quarterly savings deployed from bank to investments (PLN, before FX split). */
export const DEMO_QUARTERLY_INVESTMENT_PLN = 26_000;

/** Keep only this fraction of brokerage cash uninvested after seeding. */
export const BROKER_CASH_RESERVE_FRACTION = 0.04;

/** Manual Polish bond (no Twelve Data EOD) for obligacje slice. */
export const GPW_BOND_INSTRUMENT: DemoInstrumentSpec = {
  instrumentType: "BOND",
  symbol: "EDO",
  name: "Obligacje skarbowe EDO",
  exchange: "PL",
  currency: "PLN",
};

export const ALL_DEMO_STOCK_SYMBOLS = [
  ...GPW_INSTRUMENTS,
  ...US_INSTRUMENTS,
  ...EU_INSTRUMENTS,
  ...IKZE_INSTRUMENTS,
].map((s) => s.symbol);

export const UNIQUE_DEMO_STOCK_SYMBOLS = [...new Set(ALL_DEMO_STOCK_SYMBOLS)];
