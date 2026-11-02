import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { NetWorth, NetWorthHistory } from "../../api/statisticsApi";
import { sliceNetWorthHistory, WealthHero } from "./WealthHero";
import { AllocationCard } from "./AllocationCard";

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

const sampleNetWorth: NetWorth = {
  currency: "PLN",
  asOf: "2026-10-30",
  byBucket: {
    cash: 1000,
    stock: 500,
    crypto: 0,
    metal: 0,
    real_estate: 0,
    other: 0,
  },
  liabilities: 0,
  netWorth: 1500,
  ratesUsed: [{ currency: "EUR", rateDate: "2026-10-30", mid: 4.2 }],
};

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

describe("WealthHero copy", () => {
  afterEach(() => cleanup());

  it("states cash + holdings MTM are included", () => {
    render(
      <WealthHero
        netWorth={sampleNetWorth}
        history={null}
        currency="PLN"
      />,
    );
    expect(screen.getByText(/Cash \+ holdings MTM converted to PLN/)).toBeTruthy();
    expect(screen.queryByText(/Holdings valuations not included/)).toBeNull();
  });
});

describe("AllocationCard copy", () => {
  afterEach(() => cleanup());

  it("describes equity buckets including holdings MTM", () => {
    render(
      <MemoryRouter>
        <AllocationCard netWorth={sampleNetWorth} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(
        /Portfolio allocation by account-type bucket \(cash \+ holdings MTM\)/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Cash balances by account-type bucket/)).toBeNull();
  });
});
