import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStooqDailyCsv } from "./stooqClient";

test("parseStooqDailyCsv maps Date and Close", () => {
  const csv = [
    "Date,Open,High,Low,Close,Volume",
    "2026-10-29,10,11,9,10.5,1000",
    "2026-10-30,10.5,12,10,11.2,2000",
  ].join("\n");
  const bars = parseStooqDailyCsv(csv);
  assert.equal(bars.length, 2);
  assert.equal(bars[0]!.asOfYmd, "2026-10-29");
  assert.equal(bars[0]!.close, 10.5);
  assert.equal(bars[1]!.close, 11.2);
});

test("parseStooqDailyCsv skips invalid rows", () => {
  const csv = [
    "Date,Open,High,Low,Close,Volume",
    "bad,1,1,1,1,1",
    "2026-01-02,1,1,1,0,1",
    "2026-01-03,1,1,1,5,1",
  ].join("\n");
  const bars = parseStooqDailyCsv(csv);
  assert.equal(bars.length, 1);
  assert.equal(bars[0]!.asOfYmd, "2026-01-03");
});
