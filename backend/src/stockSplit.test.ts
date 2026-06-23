import test from "node:test";
import assert from "node:assert/strict";
import { applyStockSplit, validateSplitRatio } from "./stockSplit";

test("validateSplitRatio rejects non-positive", () => {
  assert.throws(() => validateSplitRatio(0));
  assert.throws(() => validateSplitRatio(-2));
});

test("applyStockSplit scales quantities and divides per-share cost", async () => {
  const updates: Array<{ id: number; quantity: number; quantityAfter: number; pricePerUnit: number }> =
    [];
  const db = {
    holdingLot: {
      findMany: async () => [
        {
          id: 1,
          quantity: 10,
          quantityAfter: 10,
          pricePerUnit: 100,
          totalPrice: 1000,
        },
        {
          id: 2,
          quantity: 5,
          quantityAfter: 15,
          pricePerUnit: 120,
          totalPrice: 600,
        },
      ],
      update: async ({
        where,
        data,
      }: {
        where: { id: number };
        data: { quantity: number; quantityAfter: number; pricePerUnit: number };
      }) => {
        updates.push({ id: where.id, ...data });
      },
    },
  };

  await applyStockSplit(db as never, 99, 4);
  assert.deepEqual(updates, [
    { id: 1, quantity: 40, quantityAfter: 40, pricePerUnit: 25 },
    { id: 2, quantity: 20, quantityAfter: 60, pricePerUnit: 30 },
  ]);
});
