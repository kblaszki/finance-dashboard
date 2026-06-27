import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveSqlitePath } from "./dbPath";

test("resolveSqlitePath resolves relative file URLs", () => {
  const cwd = path.join("D:", "app", "backend");
  const resolved = resolveSqlitePath("file:./dev.db", cwd);
  assert.equal(resolved, path.join(cwd, "dev.db"));
});

test("resolveSqlitePath keeps absolute paths", () => {
  const abs = path.join("D:", "data", "prod.db");
  assert.equal(resolveSqlitePath(`file:${abs}`), abs);
});
