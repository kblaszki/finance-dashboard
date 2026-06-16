import test from "node:test";
import assert from "node:assert/strict";
import {
  computeQuantityAfter,
  resolveLotPrice,
  recomputeQuantityAfterChain,
  priceAsOf,
  isValidLotSide,
} from "./holdingLot";

test("computeQuantityAfter BUY and SELL", () => {
  assert.equal(computeQuantityAfter(0, "BUY", 10), 10);
  assert.equal(computeQuantityAfter(10, "BUY", 5), 15);
  assert.equal(computeQuantityAfter(15, "SELL", 5), 10);
  assert.equal(computeQuantityAfter(10, "SELL", 10), 0);
});

test("computeQuantityAfter rejects oversell", () => {
  assert.throws(() => computeQuantityAfter(5, "SELL", 10));
});

test("computeQuantityAfter rejects non-positive quantity", () => {
  assert.throws(() => computeQuantityAfter(0, "BUY", 0));
  assert.throws(() => computeQuantityAfter(0, "BUY", -1));
});

test("isValidLotSide", () => {
  assert.equal(isValidLotSide("BUY"), true);
  assert.equal(isValidLotSide("SELL"), true);
  assert.equal(isValidLotSide("HOLD"), false);
});

test("resolveLotPrice XOR", () => {
  assert.deepEqual(resolveLotPrice({ quantity: 10, pricePerUnit: 50 }), {
    totalPrice: 500,
    pricePerUnit: 50,
  });
  assert.deepEqual(resolveLotPrice({ quantity: 10, totalPrice: 500 }), {
    totalPrice: 500,
    pricePerUnit: 50,
  });
});

test("resolveLotPrice rejects inconsistent prices", () => {
  assert.throws(() =>
    resolveLotPrice({ quantity: 10, totalPrice: 500, pricePerUnit: 60 }),
  );
});

test("resolveLotPrice rejects missing price", () => {
  assert.throws(() => resolveLotPrice({ quantity: 10 }));
});

test("recomputeQuantityAfterChain after middle delete scenario", () => {
  const chain = recomputeQuantityAfterChain([
    { id: 1, side: "BUY", quantity: 10 },
    { id: 3, side: "BUY", quantity: 3 },
  ]);
  assert.equal(chain.get(1), 10);
  assert.equal(chain.get(3), 13);
});

test("recomputeQuantityAfterChain with SELL", () => {
  const chain = recomputeQuantityAfterChain([
    { id: 1, side: "BUY", quantity: 10 },
    { id: 2, side: "SELL", quantity: 4 },
    { id: 3, side: "BUY", quantity: 2 },
  ]);
  assert.equal(chain.get(1), 10);
  assert.equal(chain.get(2), 6);
  assert.equal(chain.get(3), 8);
});

test("recomputeQuantityAfterChain rejects invalid side", () => {
  assert.throws(() =>
    recomputeQuantityAfterChain([{ id: 1, side: "SHORT", quantity: 1 }]),
  );
});

test("priceAsOf forward-fill", () => {
  const d1 = new Date("2025-01-01");
  const d5 = new Date("2025-01-05");
  const d3 = new Date("2025-01-03");
  const p = priceAsOf(
    [
      { valuationDate: d1, price: 100 },
      { valuationDate: d5, price: 110 },
    ],
    d3,
  );
  assert.equal(p, 100);
});

test("priceAsOf returns null before first valuation", () => {
  const d1 = new Date("2025-01-01");
  const before = new Date("2024-12-31");
  const p = priceAsOf([{ valuationDate: d1, price: 100 }], before);
  assert.equal(p, null);
});
