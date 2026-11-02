import assert from "node:assert/strict";
import test from "node:test";
import { parseRecentActivityLimit } from "./recentActivity";

test("parseRecentActivityLimit defaults and bounds", () => {
  assert.equal(parseRecentActivityLimit(undefined), 8);
  assert.equal(parseRecentActivityLimit("12"), 12);
  assert.throws(() => parseRecentActivityLimit(0));
  assert.throws(() => parseRecentActivityLimit(51));
  assert.throws(() => parseRecentActivityLimit("x"));
});
