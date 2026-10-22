import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeListCursor,
  encodeListCursor,
  pageResultFromRows,
  parseListPageQuery,
} from "./listPageQuery";

describe("parseListPageQuery", () => {
  it("parses a UTC month window", () => {
    const q = parseListPageQuery({ month: "2026-03" });
    assert.equal(q.mode, "month");
    if (q.mode !== "month") return;
    assert.equal(q.month, "2026-03");
    assert.equal(q.start.toISOString(), "2026-03-01T00:00:00.000Z");
    assert.equal(q.end.toISOString(), "2026-04-01T00:00:00.000Z");
  });

  it("defaults cursor mode limit to 100", () => {
    const q = parseListPageQuery({});
    assert.equal(q.mode, "cursor");
    if (q.mode !== "cursor") return;
    assert.equal(q.limit, 100);
    assert.equal(q.beforeId, null);
  });

  it("decodes cursor and rejects month+cursor", () => {
    const cursor = encodeListCursor(new Date("2026-01-15T12:00:00.000Z"), 9);
    const q = parseListPageQuery({ cursor, limit: "2" });
    assert.equal(q.mode, "cursor");
    if (q.mode !== "cursor") return;
    assert.equal(q.limit, 2);
    assert.equal(q.beforeId, 9);
    assert.throws(() => parseListPageQuery({ month: "2026-01", cursor }));
  });
});

describe("pageResultFromRows", () => {
  it("sets nextCursor when more rows exist", () => {
    const rows = [
      { id: 3, occurredAt: new Date("2026-02-01T12:00:00.000Z") },
      { id: 2, occurredAt: new Date("2026-01-15T12:00:00.000Z") },
      { id: 1, occurredAt: new Date("2026-01-01T12:00:00.000Z") },
    ];
    const page = pageResultFromRows(rows, 2);
    assert.equal(page.items.length, 2);
    assert.ok(page.nextCursor);
    const decoded = decodeListCursor(page.nextCursor!);
    assert.equal(decoded.id, 2);
  });
});
