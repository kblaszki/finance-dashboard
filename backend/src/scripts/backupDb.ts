import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { resolveSqlitePath } from "../dbPath";

dotenv.config();

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = resolveSqlitePath(databaseUrl, cwd);
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`);
  }

  const backupDir = path.resolve(cwd, process.env.BACKUP_DIR ?? "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const gzip = process.argv.includes("--gzip") || process.env.BACKUP_GZIP === "true";
  const baseName = `finance-${timestamp()}.db`;
  const destPath = path.join(backupDir, gzip ? `${baseName}.gz` : baseName);

  if (gzip) {
    await pipeline(createReadStream(dbPath), zlib.createGzip(), createWriteStream(destPath));
  } else {
    fs.copyFileSync(dbPath, destPath);
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, source: dbPath, backup: destPath, gzip }));
}

void main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
