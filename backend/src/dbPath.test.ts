import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { resolveSqlitePath } from "./dbPath";

test("resolveSqlitePath resolves relative file URLs", () => {
  const cwd = path.resolve("/tmp/project");
  const resolved = resolveSqlitePath("file:./dev.db", cwd);
  assert.equal(resolved, path.resolve(cwd, "dev.db"));
});

test("resolveSqlitePath keeps absolute paths", () => {
  if (process.platform === "win32") {
    const resolved = resolveSqlitePath("file:C:/data/app.db");
    assert.equal(path.normalize(resolved), path.normalize("C:/data/app.db"));
  } else {
    const resolved = resolveSqlitePath("file:/var/data/app.db");
    assert.equal(resolved, "/var/data/app.db");
  }
});

test("resolveSqlitePath rejects non-file URLs", () => {
  assert.throws(() => resolveSqlitePath("postgres://localhost/db"), /Only file:/);
});
