import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  defaultAllowlistHistoryPath,
  demoHistoryFixturePath,
  resolveDemoHistorySource,
} from "./marketHistoryIo";

test("resolveDemoHistorySource prefers local export over committed fixture", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mkt-hist-"));
  try {
    fs.mkdirSync(path.join(dir, "exports"), { recursive: true });
    fs.writeFileSync(demoHistoryFixturePath(dir), "{}\n");
    const withoutExport = resolveDemoHistorySource(dir);
    assert.equal(withoutExport.kind, "committed-fixture");

    fs.writeFileSync(defaultAllowlistHistoryPath(dir), "{}\n");
    const withExport = resolveDemoHistorySource(dir);
    assert.equal(withExport.kind, "local-export");
    assert.equal(withExport.path, defaultAllowlistHistoryPath(dir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("defaultAllowlistHistoryPath lives under exports/", () => {
  const p = defaultAllowlistHistoryPath("/tmp/market-history");
  assert.equal(p, "/tmp/market-history/exports/allowlist-eod.ndjson.gz");
});
