import { describe, expect, it } from "vitest";
import { buildDashboardIdeas } from "./dashboardIdeas";
import type { NetWorth, PeriodSummary } from "../api/statisticsApi";

const summary = (overrides: Partial<PeriodSummary> = {}): PeriodSummary => ({
  month: "2026-10",
  period: "month",
  label: "October 2026",
  currency: "PLN",
  income: 10000,
  expense: 6000,
  net: 4000,
  transfers: 0,
  ...overrides,
});

const netWorth = (overrides: Partial<NetWorth> = {}): NetWorth => ({
  currency: "PLN",
  asOf: "2026-10-28",
  byBucket: {
    cash: 100,
    stock: 50,
    crypto: 0,
    metal: 0,
    real_estate: 0,
    other: 0,
  },
  liabilities: 0,
  netWorth: 150,
  ratesUsed: [],
  ...overrides,
});

describe("buildDashboardIdeas", () => {
  it("includes surplus and savings tips when month has income and net", () => {
    const ideas = buildDashboardIdeas({
      currency: "PLN",
      summary: summary(),
      netWorth: netWorth(),
    });
    expect(ideas.map((i) => i.id)).toEqual([
      "surplus",
      "savings-rate",
      "allocation",
    ]);
  });

  it("surfaces liabilities tip when debt exists", () => {
    const ideas = buildDashboardIdeas({
      currency: "PLN",
      summary: summary({ income: 0, net: 0 }),
      netWorth: netWorth({ liabilities: 500 }),
    });
    expect(ideas.some((i) => i.id === "liabilities")).toBe(true);
  });

  it("falls back to transfers tip when nothing else applies", () => {
    const ideas = buildDashboardIdeas({
      currency: "PLN",
      summary: null,
      netWorth: null,
    });
    expect(ideas).toHaveLength(1);
    expect(ideas[0]?.id).toBe("transfers");
  });
});
