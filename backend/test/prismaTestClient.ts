import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const TMP_DIR = path.join(__dirname, "tmp");
const BACKEND_ROOT = path.join(__dirname, "..");

const pushedUrls = new Set<string>();

export function getTestDatabaseUrl(): string {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
  const dbPath = path.join(TMP_DIR, `test-${process.pid}.db`);
  return `file:${dbPath.replace(/\\/g, "/")}`;
}

function pushSchema(url: string): void {
  execSync("npx prisma db push --skip-generate", {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}

function ensureSchemaForUrl(url: string): void {
  if (pushedUrls.has(url)) return;
  pushSchema(url);
  pushedUrls.add(url);
}

/** Ensures DATABASE_URL and schema exist (CI has no backend/.env). */
export function ensureTestDatabaseEnv(): void {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = getTestDatabaseUrl();
  }
  ensureSchemaForUrl(process.env.DATABASE_URL);
}

export async function createTestPrisma(): Promise<PrismaClient> {
  const url = getTestDatabaseUrl();
  process.env.DATABASE_URL = url;
  ensureSchemaForUrl(url);
  return new PrismaClient({ datasources: { db: { url } } });
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.importRow.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.holdingValuationDaily.deleteMany();
  await prisma.accountValuationDaily.deleteMany();
  await prisma.holdingLot.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.instrumentValuation.deleteMany();
  await prisma.account.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectTestPrisma(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect();
}
