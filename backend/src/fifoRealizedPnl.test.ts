import test from "node:test";
import assert from "node:assert/strict";
import { computeFifoRealizedEvents, sumGainLoss } from "./fifoRealizedPnl";

const d = (iso: string) => new Date(iso);

test("FIFO single buy then full sell", () => {
  const events = computeFifoRealizedEvents([
    { id: 1, side: "BUY", quantity: 5, pricePerUnit: 100, currency: "PLN", tradeDate: d("2025-01-01") },
    { id: 2, side: "SELL", quantity: 5, pricePerUnit: 120, currency: "PLN", tradeDate: d("2025-06-01") },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].gainLoss, 100);
});

test("FIFO multiple buys then partial sell uses oldest lots first", () => {
  const events = computeFifoRealizedEvents([
    { id: 1, side: "BUY", quantity: 10, pricePerUnit: 40, currency: "PLN", tradeDate: d("2024-01-01") },
    { id: 2, side: "BUY", quantity: 10, pricePerUnit: 60, currency: "PLN", tradeDate: d("2024-06-01") },
    { id: 3, side: "SELL", quantity: 12, pricePerUnit: 50, currency: "PLN", tradeDate: d("2025-03-01") },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].cost, 10 * 40 + 2 * 60);
  assert.equal(events[0].proceeds, 12 * 50);
  assert.equal(events[0].gainLoss, events[0].proceeds - events[0].cost);
});

test("FIFO ignores non-trade lot sides", () => {
  const events = computeFifoRealizedEvents([
    { id: 1, side: "BUY", quantity: 5, pricePerUnit: 100, currency: "PLN", tradeDate: d("2025-01-01") },
    { id: 2, side: "DIVIDEND", quantity: 1, pricePerUnit: 10, currency: "PLN", tradeDate: d("2025-03-01") },
    { id: 3, side: "SELL", quantity: 5, pricePerUnit: 120, currency: "PLN", tradeDate: d("2025-06-01") },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].gainLoss, 100);
});

test("sumGainLoss totals realized events", () => {
  const events = computeFifoRealizedEvents([
    { id: 1, side: "BUY", quantity: 2, pricePerUnit: 50, currency: "PLN", tradeDate: d("2025-01-01") },
    { id: 2, side: "SELL", quantity: 2, pricePerUnit: 80, currency: "PLN", tradeDate: d("2025-02-01") },
  ]);
  assert.equal(sumGainLoss(events), 60);
});

test("FIFO includes commission in buy cost and sell proceeds", () => {
  const events = computeFifoRealizedEvents([
    {
      id: 1,
      side: "BUY",
      quantity: 10,
      pricePerUnit: 100,
      totalPrice: 1000,
      commission: 10,
      currency: "PLN",
      tradeDate: d("2025-01-01"),
    },
    {
      id: 2,
      side: "SELL",
      quantity: 10,
      pricePerUnit: 120,
      totalPrice: 1200,
      commission: 5,
      currency: "PLN",
      tradeDate: d("2025-06-01"),
    },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].cost, 1010);
  assert.equal(events[0].proceeds, 1195);
  assert.equal(events[0].gainLoss, 185);
});

test("FIFO rejects oversell", () => {
  assert.throws(() =>
    computeFifoRealizedEvents([
      { id: 1, side: "BUY", quantity: 5, pricePerUnit: 100, currency: "PLN", tradeDate: d("2025-01-01") },
      { id: 2, side: "SELL", quantity: 6, pricePerUnit: 110, currency: "PLN", tradeDate: d("2025-02-01") },
    ]),
  );
});

test("FIFO rejects sell in currency without matching buy lots", () => {
  assert.throws(
    () =>
      computeFifoRealizedEvents([
        { id: 1, side: "BUY", quantity: 5, pricePerUnit: 100, currency: "USD", tradeDate: d("2025-01-01") },
        { id: 2, side: "SELL", quantity: 5, pricePerUnit: 400, currency: "PLN", tradeDate: d("2025-02-01") },
      ]),
    /currency mismatch/i,
  );
});
