import test from "node:test";
import assert from "node:assert/strict";
import { replayCashBalance, type CashReplayEvent } from "./accountValuation";

const d = (iso: string) => new Date(iso);

test("replayCashBalance applies transactions only (bank-like)", () => {
  const events: CashReplayEvent[] = [
    {
      kind: "tx",
      at: d("2025-01-05T12:00:00.000Z"),
      id: 1,
      transactionType: "INCOME",
      amount: 500,
    },
    {
      kind: "tx",
      at: d("2025-01-10T12:00:00.000Z"),
      id: 2,
      transactionType: "EXPENSE",
      amount: 50,
    },
  ];
  assert.equal(replayCashBalance(1000, events, d("2025-01-10T23:59:59.999Z")), 1450);
  assert.equal(replayCashBalance(1000, events, d("2025-01-07T12:00:00.000Z")), 1500);
});

test("replayCashBalance transfer in then BUY reduces cash", () => {
  const events: CashReplayEvent[] = [
    {
      kind: "tx",
      at: d("2025-01-02T12:00:00.000Z"),
      id: 1,
      transactionType: "TRANSFER_IN",
      amount: 15000,
    },
    {
      kind: "lot",
      at: d("2025-01-05T12:00:00.000Z"),
      id: 1,
      side: "BUY",
      totalPrice: 6400,
    },
  ];
  assert.equal(replayCashBalance(0, events, d("2025-01-05T23:59:59.999Z")), 8600);
  assert.equal(replayCashBalance(0, events, d("2025-01-03T12:00:00.000Z")), 15000);
});

test("replayCashBalance BUY then SELL nets trade cash", () => {
  const events: CashReplayEvent[] = [
    {
      kind: "tx",
      at: d("2025-01-01T12:00:00.000Z"),
      id: 1,
      transactionType: "TRANSFER_IN",
      amount: 10000,
    },
    {
      kind: "lot",
      at: d("2025-01-03T12:00:00.000Z"),
      id: 1,
      side: "BUY",
      totalPrice: 1000,
    },
    {
      kind: "lot",
      at: d("2025-01-12T12:00:00.000Z"),
      id: 2,
      side: "SELL",
      totalPrice: 330,
    },
  ];
  assert.equal(replayCashBalance(0, events, d("2025-01-20T12:00:00.000Z")), 9330);
});
