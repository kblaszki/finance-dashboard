import test from "node:test";
import assert from "node:assert/strict";
import { matchCategorizationRule, parseMatchType } from "./categorizationRules";

test("matchCategorizationRule prefers higher priority among matching rules", () => {
  const result = matchCategorizationRule("PAYMENT AT ORLEN STATION", [
    {
      pattern: "ORLEN",
      matchType: "contains",
      priority: 1,
      active: true,
      categoryId: 1,
      category: { name: "Fuel" },
    },
    {
      pattern: "ORLEN",
      matchType: "contains",
      priority: 10,
      active: true,
      categoryId: 2,
      category: { name: "Fuel premium" },
    },
  ]);
  assert.equal(result?.categoryName, "Fuel premium");
});

test("matchCategorizationRule skips inactive rules", () => {
  const result = matchCategorizationRule("ORLEN", [
    {
      pattern: "ORLEN",
      matchType: "contains",
      priority: 5,
      active: false,
      categoryId: 1,
      category: { name: "Fuel" },
    },
  ]);
  assert.equal(result, null);
});

test("matchCategorizationRule supports regex and ignores invalid patterns", () => {
  const ok = matchCategorizationRule("Invoice 123", [
    {
      pattern: "invoice \\d+",
      matchType: "regex",
      priority: 0,
      active: true,
      categoryId: 3,
      category: { name: "Bills" },
    },
  ]);
  assert.equal(ok?.categoryId, 3);

  const badRegex = matchCategorizationRule("text", [
    {
      pattern: "[invalid",
      matchType: "regex",
      priority: 0,
      active: true,
      categoryId: 1,
      category: { name: "X" },
    },
  ]);
  assert.equal(badRegex, null);
});

test("parseMatchType rejects unknown values", () => {
  assert.throws(() => parseMatchType("fuzzy"), /Invalid matchType/);
});
