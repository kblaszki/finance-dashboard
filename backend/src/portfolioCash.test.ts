import test from "node:test";
import assert from "node:assert/strict";
import { computePortfolioCashBalance } from "./portfolioCash";

test("transfer increases cash and buy decreases it", () => {
  const balance = computePortfolioCashBalance(
    [{ amount: 1000 }],
    [{ side: "BUY", quantity: 2, tradePrice: 100 }],
  );
  assert.equal(balance, 800);
});

test("sell increases cash", () => {
  const balance = computePortfolioCashBalance(
    [{ amount: 1000 }],
    [
      { side: "BUY", quantity: 1, tradePrice: 300 },
      { side: "SELL", quantity: 1, tradePrice: 350 },
    ],
  );
  assert.equal(balance, 1050);
});

