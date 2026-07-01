import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest } from "./routes/httpSupport";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const BANK_CONNECTION_STATUSES = ["pending", "connected", "error"] as const;

export type BankConnectionInput = {
  accountId: number;
  bankCode: string;
};

async function assertBankAccount(db: DbClient, userId: number, accountId: number) {
  const account = await db.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw badRequest("Invalid accountId");
  if (account.accountType !== "BANK") {
    throw badRequest("PSD2 connections require a BANK account");
  }
  return account;
}

export async function listBankConnections(db: DbClient, userId: number) {
  return db.bankConnection.findMany({
    where: { userId },
    include: { account: { select: { id: true, name: true, currency: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createBankConnection(
  db: DbClient,
  userId: number,
  input: BankConnectionInput,
) {
  await assertBankAccount(db, userId, input.accountId);
  const bankCode = input.bankCode.trim().toUpperCase();
  if (!bankCode) throw badRequest("bankCode is required");

  return db.bankConnection.upsert({
    where: { accountId: input.accountId },
    create: {
      userId,
      accountId: input.accountId,
      bankCode,
      status: "pending",
    },
    update: {
      bankCode,
      status: "pending",
      errorMessage: null,
    },
    include: { account: { select: { id: true, name: true, currency: true } } },
  });
}

export async function authorizeBankConnectionStub(db: DbClient, userId: number, id: number) {
  const row = await db.bankConnection.findFirst({ where: { id, userId } });
  if (!row) throw badRequest("Bank connection not found");

  const consentExpiresAt = new Date();
  consentExpiresAt.setUTCDate(consentExpiresAt.getUTCDate() + 90);

  return db.bankConnection.update({
    where: { id },
    data: {
      status: "connected",
      consentExpiresAt,
      errorMessage: null,
    },
    include: { account: { select: { id: true, name: true, currency: true } } },
  });
}

export async function deleteBankConnection(db: DbClient, userId: number, id: number): Promise<void> {
  const row = await db.bankConnection.findFirst({ where: { id, userId } });
  if (!row) throw badRequest("Bank connection not found");
  await db.bankConnection.delete({ where: { id } });
}

export function serializeBankConnection(row: {
  id: number;
  accountId: number;
  bankCode: string;
  status: string;
  consentExpiresAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  account?: { id: number; name: string; currency: string };
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    accountCurrency: row.account?.currency ?? null,
    bankCode: row.bankCode,
    status: row.status,
    consentExpiresAt: row.consentExpiresAt?.toISOString() ?? null,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    authorizeUrl: null as string | null,
    stubNote:
      "PSD2 OAuth is stubbed in MVP. Use POST .../authorize to simulate consent (FR-036).",
  };
}
