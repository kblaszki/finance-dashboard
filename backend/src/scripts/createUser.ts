import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { hashPassword, normalizeEmail, validatePassword } from "../auth";

dotenv.config();

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const email = normalizeEmail(readArg("--email") ?? "");
  const username = String(readArg("--username") ?? "").trim();
  const password = readArg("--password") ?? "";

  if (!email || !username) {
    throw new Error("Usage: createUser.ts --email <email> --username <name> --password <password>");
  }
  const pwdErr = validatePassword(password);
  if (pwdErr) throw new Error(pwdErr);

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error(`User already exists: ${email}`);
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ id: user.id, email: user.email, username: user.username }));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
