import { describe, expect, it } from "vitest";
import {
  formatPeriodDelta,
  percentDelta,
  previousPeriodAnchor,
  shiftUtcMonth,
} from "./periodCompare";

describe("shiftUtcMonth", () => {
  it("rolls back across year boundary", () => {
    expect(shiftUtcMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("previousPeriodAnchor", () => {
  it("shifts by one month", () => {
    expect(previousPeriodAnchor("2026-03", "month")).toBe("2026-02");
  });

  it("shifts by one quarter from quarter start anchor", () => {
    expect(previousPeriodAnchor("2026-04", "quarter")).toBe("2026-01");
  });

  it("shifts by one year from January anchor", () => {
    expect(previousPeriodAnchor("2026-01", "year")).toBe("2025-01");
  });
});

describe("percentDelta / formatPeriodDelta", () => {
  it("computes signed percent", () => {
    expect(percentDelta(120, 100)).toBe(20);
    expect(percentDelta(80, 100)).toBe(-20);
  });

  it("returns null and dash when previous is zero", () => {
    expect(percentDelta(50, 0)).toBeNull();
    expect(formatPeriodDelta(50, 0)).toBe("— vs prev");
  });

  it("formats with sign", () => {
    expect(formatPeriodDelta(120, 100)).toBe("+20% vs prev");
  });
});
