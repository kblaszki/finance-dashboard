import assert from "node:assert/strict";
import test from "node:test";
import { readArg } from "./cliArgs";

test("readArg supports space and equals forms", () => {
  assert.equal(readArg("--range", ["node", "x", "--range", "10y"]), "10y");
  assert.equal(readArg("--range", ["node", "x", "--range=10y"]), "10y");
  assert.equal(readArg("--range", ["node", "x", "--force"]), undefined);
  assert.equal(readArg("--out", ["node", "x", "--out=/tmp/a.gz"]), "/tmp/a.gz");
});
