export type BenchmarkId = "WIG" | "SP500";

export type BenchmarkDefinition = {
  id: BenchmarkId;
  label: string;
  symbol: string;
  exchange: string;
  currency: string;
};

export const BENCHMARKS: Record<BenchmarkId, BenchmarkDefinition> = {
  WIG: {
    id: "WIG",
    label: "WIG (proxy: WIG20)",
    symbol: "WIG20",
    exchange: "GPW",
    currency: "PLN",
  },
  SP500: {
    id: "SP500",
    label: "S&P 500 (proxy: SPY)",
    symbol: "SPY",
    exchange: "NYSE",
    currency: "USD",
  },
};

export function parseBenchmarkId(value: unknown): BenchmarkId {
  const id = String(value ?? "").trim().toUpperCase();
  if (id === "WIG" || id === "SP500") return id;
  throw new Error("benchmark must be WIG or SP500");
}
