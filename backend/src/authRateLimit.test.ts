import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { mountProductionAuthRateLimit } from "./app";

test("production auth limiter returns 429 past the max", async () => {
  const app = express();
  const limiter = rateLimit({
    windowMs: 60_000,
    max: 2,
    standardHeaders: true,
    legacyHeaders: false,
  });
  mountProductionAuthRateLimit(app, "production", limiter);
  app.post("/api/auth/login", (_req, res) => {
    res.status(401).json({ error: "Invalid credentials" });
  });

  assert.equal((await request(app).post("/api/auth/login").send({})).status, 401);
  assert.equal((await request(app).post("/api/auth/login").send({})).status, 401);
  assert.equal((await request(app).post("/api/auth/login").send({})).status, 429);
});
