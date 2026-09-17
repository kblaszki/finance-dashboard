import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import {
  mountApiNotFound,
  mountSecurityMiddleware,
  mountStaticAndSpa,
  resolveCorsMode,
  resolveStaticDir,
} from "./httpConfig";

test("resolveCorsMode is open outside production when origin unset", () => {
  assert.deepEqual(resolveCorsMode("development", undefined, undefined), { kind: "open" });
  assert.deepEqual(resolveCorsMode("test", "", ""), { kind: "open" });
});

test("resolveCorsMode is off in production when origin unset", () => {
  assert.deepEqual(resolveCorsMode("production", undefined, undefined), { kind: "off" });
  assert.deepEqual(resolveCorsMode("production", "  ", "  "), { kind: "off" });
});

test("resolveCorsMode prefers CORS_ORIGIN then APP_ORIGIN", () => {
  assert.deepEqual(resolveCorsMode("production", "https://a.example", "https://b.example"), {
    kind: "origin",
    origin: "https://a.example",
  });
  assert.deepEqual(resolveCorsMode("production", undefined, "https://b.example"), {
    kind: "origin",
    origin: "https://b.example",
  });
  assert.deepEqual(resolveCorsMode("development", " https://a.example ", undefined), {
    kind: "origin",
    origin: "https://a.example",
  });
});

test("resolveStaticDir returns dir when index.html exists", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-static-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<html>ok</html>");
  try {
    assert.equal(resolveStaticDir(dir), dir);
    assert.equal(resolveStaticDir(undefined, dir), dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveStaticDir returns null when index.html is missing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-static-missing-"));
  try {
    assert.equal(resolveStaticDir(dir), null);
    assert.equal(resolveStaticDir(undefined, dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("mountSecurityMiddleware allows open CORS outside production", async () => {
  const app = express();
  mountSecurityMiddleware(app, "development");
  app.get("/ping", (_req, res) => {
    res.json({ ok: true });
  });
  const res = await request(app).get("/ping").set("Origin", "http://localhost:5173");
  assert.equal(res.status, 200);
  assert.equal(res.headers["access-control-allow-origin"], "*");
});

test("mountSecurityMiddleware skips CORS in production without origin", async () => {
  const app = express();
  mountSecurityMiddleware(app, "production");
  app.get("/ping", (_req, res) => {
    res.json({ ok: true });
  });
  const res = await request(app).get("/ping");
  assert.equal(res.status, 200);
  assert.equal(res.headers["access-control-allow-origin"], undefined);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
});

test("mountSecurityMiddleware restricts CORS when origin set", async () => {
  const prevCors = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = "https://finance.example.com";
  try {
    const app = express();
    mountSecurityMiddleware(app, "production");
    app.get("/ping", (_req, res) => {
      res.json({ ok: true });
    });
    const res = await request(app).get("/ping").set("Origin", "https://finance.example.com");
    assert.equal(res.status, 200);
    assert.equal(res.headers["access-control-allow-origin"], "https://finance.example.com");
  } finally {
    if (prevCors === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = prevCors;
  }
});

test("mountStaticAndSpa skips when no index.html and ignores non-GET", async () => {
  const prev = process.env.STATIC_DIR;
  delete process.env.STATIC_DIR;
  try {
    const app = express();
    mountStaticAndSpa(app);
    const missing = await request(app).get("/dashboard");
    assert.equal(missing.status, 404);
    const posted = await request(app).post("/dashboard");
    assert.equal(posted.status, 404);
  } finally {
    if (prev === undefined) delete process.env.STATIC_DIR;
    else process.env.STATIC_DIR = prev;
  }
});

test("mountStaticAndSpa does not SPA-fallback POST when static dir exists", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-spa-post-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<html>spa</html>");
  const prev = process.env.STATIC_DIR;
  process.env.STATIC_DIR = dir;
  try {
    const app = express();
    mountStaticAndSpa(app);
    const posted = await request(app).post("/dashboard");
    assert.equal(posted.status, 404);
  } finally {
    if (prev === undefined) delete process.env.STATIC_DIR;
    else process.env.STATIC_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("mountStaticAndSpa serves index.html for unknown non-API GET", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fd-spa-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<html>spa</html>");
  const prev = process.env.STATIC_DIR;
  process.env.STATIC_DIR = dir;
  try {
    const app = express();
    mountApiNotFound(app);
    mountStaticAndSpa(app);
    const spa = await request(app).get("/dashboard");
    assert.equal(spa.status, 200);
    assert.match(spa.text, /spa/);
    const api404 = await request(app).get("/api/does-not-exist");
    assert.equal(api404.status, 404);
    assert.deepEqual(api404.body, { error: "Not found" });
  } finally {
    if (prev === undefined) delete process.env.STATIC_DIR;
    else process.env.STATIC_DIR = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
