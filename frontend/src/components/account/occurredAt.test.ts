import { describe, expect, it } from "vitest";
import {
  dateInputToIso,
  defaultOccurredAtValue,
  formatDateLocal,
  formatOccurredAt,
  shiftOccurredAtByDays,
  toDateLocalValue,
} from "./occurredAt";

describe("occurredAt helpers", () => {
  it("defaultOccurredAtValue is YYYY-MM-DD for today", () => {
    expect(defaultOccurredAtValue()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(defaultOccurredAtValue()).toBe(formatDateLocal(new Date()));
  });

  it("toDateLocalValue uses the local calendar day", () => {
    expect(toDateLocalValue("2026-03-01T12:00:00.000Z")).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("dateInputToIso stores local noon", () => {
    const iso = dateInputToIso("2026-06-15");
    const d = new Date(iso);
    expect(d.getHours()).toBe(12);
    expect(d.getMinutes()).toBe(0);
    expect(formatDateLocal(d)).toBe("2026-06-15");
  });

  it("dateInputToIso rejects invalid calendar dates", () => {
    expect(() => dateInputToIso("2026-02-30")).toThrow("Invalid date");
    expect(() => dateInputToIso("not-a-date")).toThrow("Invalid date");
  });

  it("formatOccurredAt shows date without time", () => {
    const formatted = formatOccurredAt("2026-03-01T12:00:00.000Z");
    expect(formatted).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("shiftOccurredAtByDays moves the calendar day", () => {
    expect(shiftOccurredAtByDays("2026-03-01", 1)).toBe("2026-03-02");
  });
});
