import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePeriodParam, parseStatsPeriod } from "./statsPeriod";

describe("parsePeriodParam", () => {
  it("defaults to month and rejects unknown values", () => {
    assert.equal(parsePeriodParam(undefined), "month");
    assert.equal(parsePeriodParam("QUARTER"), "quarter");
    assert.throws(() => parsePeriodParam("week"), /period must be/);
  });
});

describe("parseStatsPeriod", () => {
  it("expands a calendar month", () => {
    const p = parseStatsPeriod("2026-02", "month");
    assert.equal(p.label, "2026-02");
    assert.equal(p.endMonth, "2026-02");
    assert.equal(p.start.toISOString(), "2026-02-01T00:00:00.000Z");
    assert.equal(p.end.toISOString(), "2026-03-01T00:00:00.000Z");
  });

  it("expands the calendar quarter containing the anchor month", () => {
    const q1 = parseStatsPeriod("2026-02", "quarter");
    assert.equal(q1.label, "2026 Q1");
    assert.equal(q1.endMonth, "2026-03");
    assert.equal(q1.start.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(q1.end.toISOString(), "2026-04-01T00:00:00.000Z");

    const q4 = parseStatsPeriod("2025-12", "quarter");
    assert.equal(q4.label, "2025 Q4");
    assert.equal(q4.endMonth, "2025-12");
    assert.equal(q4.start.toISOString(), "2025-10-01T00:00:00.000Z");
    assert.equal(q4.end.toISOString(), "2026-01-01T00:00:00.000Z");
  });

  it("expands the calendar year containing the anchor month", () => {
    const p = parseStatsPeriod("2024-07", "year");
    assert.equal(p.label, "2024");
    assert.equal(p.endMonth, "2024-12");
    assert.equal(p.start.toISOString(), "2024-01-01T00:00:00.000Z");
    assert.equal(p.end.toISOString(), "2025-01-01T00:00:00.000Z");
  });
});
