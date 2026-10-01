import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { HttpError } from "../lib/errors";
import {
  decimalToMinor,
  majorToDecimal,
  minorToMajor,
  normalizeCurrencyCode,
  parseMoneyDecimal,
  parseOpeningBalance,
  parsePositiveAmount,
} from "./money";

function rejects(fn: () => unknown): HttpError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 400);
    return error;
  }
  assert.fail("expected a 400");
}

test("parsePositiveAmount keeps cent sums exact", () => {
  const a = parsePositiveAmount("0.10");
  const b = parsePositiveAmount("0.20");
  assert.equal(a.add(b).toFixed(2), "0.30");
  assert.equal(decimalToMinor(a), 10);
  assert.equal(decimalToMinor(b), 20);
  assert.equal(minorToMajor(10 + 20), 0.3);
  assert.equal(JSON.stringify(minorToMajor(30)), "0.3");
});

test("parsePositiveAmount accepts a trimmed whole number and rejects bad scale", () => {
  assert.equal(parsePositiveAmount("  10 ").toFixed(2), "10.00");
  assert.equal(decimalToMinor(parsePositiveAmount(100.5)), 10050);
  rejects(() => parsePositiveAmount("0.001"));
  rejects(() => parsePositiveAmount("1.2345"));
  rejects(() => parsePositiveAmount(0));
  rejects(() => parsePositiveAmount("-0"));
  rejects(() => parsePositiveAmount("-1"));
  rejects(() => parsePositiveAmount("1,50"));
  rejects(() => parsePositiveAmount("nope"));
  rejects(() => parsePositiveAmount(Number.POSITIVE_INFINITY));
});

test("ten thousand cents of 0.01 sum to 100", () => {
  let minor = 0;
  const one = decimalToMinor(parsePositiveAmount("0.01"));
  for (let i = 0; i < 10000; i += 1) minor += one;
  assert.equal(minor, 10000);
  assert.equal(minorToMajor(minor), 100);
});

test("parseOpeningBalance allows zero and negatives at cent scale", () => {
  assert.equal(parseOpeningBalance(-12.34).toFixed(2), "-12.34");
  assert.equal(decimalToMinor(parseOpeningBalance(0)), 0);
  assert.equal(decimalToMinor(parseOpeningBalance("-0")), 0);
  rejects(() => parseOpeningBalance("1.234"));
});

test("magnitudes past the safe integer range are rejected", () => {
  rejects(() => parsePositiveAmount("9007199254740993"));
  rejects(() => parsePositiveAmount(1e21));
});

test("majorToDecimal sums 0.1 and 0.2 as 0.3", () => {
  const left = majorToDecimal(new Prisma.Decimal("0.1"));
  const right = majorToDecimal(new Prisma.Decimal("0.2"));
  assert.ok(left && right);
  const sum = left.add(right);
  assert.equal(JSON.stringify(sum.toNumber()), "0.3");
});

test("normalizeCurrencyCode uppercases and defaults only when asked", () => {
  assert.equal(normalizeCurrencyCode("usd"), "USD");
  assert.equal(normalizeCurrencyCode(undefined, { defaultCode: "PLN" }), "PLN");
  rejects(() => normalizeCurrencyCode(""));
  rejects(() => normalizeCurrencyCode("US"));
});
