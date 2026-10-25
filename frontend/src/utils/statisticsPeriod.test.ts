import { describe, expect, it } from "vitest";
import {
  anchorForQuarter,
  anchorForYear,
  monthIndexOf,
  quarterOf,
  yearOf,
} from "./statisticsPeriod";

describe("statisticsPeriod", () => {
  it("derives year quarter and anchors from month keys", () => {
    expect(yearOf("2026-08")).toBe(2026);
    expect(monthIndexOf("2026-08")).toBe(7);
    expect(quarterOf("2026-08")).toBe(3);
    expect(anchorForQuarter(2026, 3)).toBe("2026-07");
    expect(anchorForYear(2026)).toBe("2026-01");
  });
});
