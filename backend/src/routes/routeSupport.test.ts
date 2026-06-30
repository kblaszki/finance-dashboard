import test from "node:test";
import assert from "node:assert/strict";
import { serializeAccount } from "./routeSupport";

const baseRow = {
  id: 1,
  userId: 2,
  accountType: "BANK",
  name: "Main",
  currency: "PLN",
  cashBalance: 1500,
  openingBalance: 1000,
  description: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-15T12:00:00.000Z"),
};

test("serializeAccount defaults totalBalance to cashBalance", () => {
  const json = serializeAccount(baseRow);
  assert.equal(json.totalBalance, 1500);
  assert.equal(json.cashBalance, 1500);
});

test("serializeAccount uses explicit totalBalance when provided", () => {
  const json = serializeAccount(baseRow, 2200);
  assert.equal(json.totalBalance, 2200);
  assert.equal(json.cashBalance, 1500);
});
