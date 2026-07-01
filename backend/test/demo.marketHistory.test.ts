import { test } from "node:test";
import assert from "node:assert/strict";
import { closeOnDate, utcDateOnly } from "../prisma/demo/marketHistory";

function bar(date: string, close: number) {
  return { date: utcDateOnly(new Date(date)), close };
}

test("closeOnDate returns latest close on or before target date", () => {
  const bars = [
    bar("2024-01-02", 100),
    bar("2024-01-03", 101),
    bar("2024-01-05", 103),
  ];
  assert.equal(closeOnDate(bars, new Date("2024-01-04T15:00:00Z")), 101);
  assert.equal(closeOnDate(bars, new Date("2024-01-05T00:00:00Z")), 103);
  assert.equal(closeOnDate(bars, new Date("2024-01-01T00:00:00Z")), null);
});

test("closeOnDate picks nearest prior session across weekends", () => {
  const bars = [
    bar("2024-06-07", 50),
    bar("2024-06-10", 52),
  ];
  assert.equal(closeOnDate(bars, new Date("2024-06-09T12:00:00Z")), 50);
  assert.equal(closeOnDate(bars, new Date("2024-06-10T12:00:00Z")), 52);
});

test("closeOnDate returns null for empty bars", () => {
  assert.equal(closeOnDate([], new Date()), null);
});
