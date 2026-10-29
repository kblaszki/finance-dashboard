import { describe, expect, it } from "vitest";
import type { NetWorthHistory } from "../../api/statisticsApi";
import { sliceNetWorthHistory } from "./WealthHero";

function buildHistory(months: number): NetWorthHistory {
  return {
    currency: "PLN",
    monthCount: months,
    ratesUsed: [],
    series: Array.from({ length: months }, (_, i) => {
      const d = new Date(Date.UTC(2024, i, 1));
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      return { month, asOf: `${month}-28`, netWorth: i + 1 };
    }),
  };
}

describe("sliceNetWorthHistory", () => {
  it("returns empty when history is null", () => {
    expect(sliceNetWorthHistory(null, 6)).toEqual([]);
  });

  it("slices the trailing 6 / 12 / 24 months with short labels", () => {
    const series = buildHistory(24);

    const sliced6 = sliceNetWorthHistory(series, 6);
    expect(sliced6).toHaveLength(6);
    expect(sliced6[0]?.month).toBe("2025-07");
    expect(sliced6[5]?.month).toBe("2025-12");
    expect(sliced6[0]?.label).toBe("Jul");
    expect(sliced6[5]?.label).toBe("Dec");
    expect(sliced6[5]?.netWorth).toBe(24);

    expect(sliceNetWorthHistory(series, 12)).toHaveLength(12);
    expect(sliceNetWorthHistory(series, 24)).toHaveLength(24);
  });
});
