import test from "node:test";
import assert from "node:assert/strict";
import { matchCategorizationRule } from "../src/categorizationRules";

const rules = [
  {
    pattern: "BIEDRONKA",
    matchType: "contains",
    priority: 10,
    active: true,
    categoryId: 1,
    category: { name: "Groceries" },
  },
  {
    pattern: "^ORLEN",
    matchType: "regex",
    priority: 5,
    active: true,
    categoryId: 2,
    category: { name: "Fuel" },
  },
];

test("matchCategorizationRule matches contains by priority", () => {
  const match = matchCategorizationRule("PAYMENT BIEDRONKA 123", rules);
  assert.equal(match?.categoryName, "Groceries");
  assert.equal(match?.categoryId, 1);
});

test("matchCategorizationRule matches regex", () => {
  const match = matchCategorizationRule("ORLEN STATION", rules);
  assert.equal(match?.categoryName, "Fuel");
});

test("matchCategorizationRule returns null when no match", () => {
  assert.equal(matchCategorizationRule("UNKNOWN SHOP", rules), null);
});
