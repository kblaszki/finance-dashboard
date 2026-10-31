import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";
import { seedMarketUniverse } from "./marketUniverse";

let prisma: PrismaClient;
let tmpDir: string;

before(async () => {
  prisma = await createTestPrisma();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "universe-"));
  fs.writeFileSync(
    path.join(tmpDir, "sp500.json"),
    JSON.stringify([
      {
        symbol: "AAPL",
        name: "Apple",
        assetClass: "STOCK",
        currency: "USD",
        providerSymbol: "AAPL",
      },
    ]),
  );
  fs.writeFileSync(path.join(tmpDir, "gpw-wig20-mwig40.json"), "[]");
  fs.writeFileSync(
    path.join(tmpDir, "indices.json"),
    JSON.stringify([
      {
        symbol: "SPX",
        name: "S&P 500",
        assetClass: "INDEX",
        currency: "USD",
        providerSymbol: "SPX",
      },
    ]),
  );
  fs.writeFileSync(path.join(tmpDir, "etfs.json"), "[]");
});

after(async () => {
  await disconnectTestPrisma(prisma);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("seedMarketUniverse creates allowlisted STOCK and INDEX", async () => {
  await resetDatabase(prisma);
  const result = await seedMarketUniverse(prisma, tmpDir);
  assert.equal(result.created, 2);
  const apple = await prisma.instrument.findFirst({
    where: { providerSymbol: "AAPL" },
  });
  assert.ok(apple);
  assert.equal(apple!.allowlisted, true);
  const spx = await prisma.instrument.findFirst({
    where: { providerSymbol: "SPX" },
  });
  assert.equal(spx!.assetClass, "INDEX");
  assert.equal(spx!.allowlisted, true);
});
