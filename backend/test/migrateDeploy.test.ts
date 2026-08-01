import test from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const BACKEND_ROOT = path.join(__dirname, "..");

test("prisma migrate deploy creates User table", async () => {
  const tmpDir = path.join(__dirname, "tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const dbPath = path.join(tmpDir, `migrate-deploy-${process.pid}-${Date.now()}.db`);
  const url = `file:${dbPath.replace(/\\/g, "/")}`;

  execSync("npx prisma migrate deploy", {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const columns = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM pragma_table_info('User')
      WHERE name IN ('email', 'username', 'passwordHash')
    `;
    const names = new Set(columns.map((c) => c.name));
    assert.ok(names.has("email"));
    assert.ok(names.has("username"));
    assert.ok(names.has("passwordHash"));
  } finally {
    await prisma.$disconnect();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }
});
