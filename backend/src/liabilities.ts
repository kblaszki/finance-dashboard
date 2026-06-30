import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest } from "./routes/httpSupport";
import { convertAmount, normalizeCurrency } from "./fx";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const LIABILITY_TYPES = ["mortgage", "loan", "credit", "tax_provision", "tax_advance"] as const;
export type LiabilityType = (typeof LIABILITY_TYPES)[number];

const TYPE_SET = new Set<string>(LIABILITY_TYPES);

export type LiabilityInput = {
  name: string;
  liabilityType: LiabilityType;
  balance: number;
  currency: string;
  accountId?: number | null;
};

export function parseLiabilityType(value: unknown): LiabilityType {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!TYPE_SET.has(raw)) {
    throw badRequest(`Invalid liabilityType: ${raw}`);
  }
  return raw as LiabilityType;
}

async function assertAccountOptional(db: DbClient, userId: number, accountId: number | null | undefined) {
  if (accountId == null) return;
  const account = await db.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw badRequest("Invalid accountId");
}

export async function listUserLiabilities(db: DbClient, userId: number) {
  return db.liability.findMany({
    where: { userId },
    include: { account: { select: { id: true, name: true } } },
    orderBy: [{ balance: "desc" }, { name: "asc" }],
  });
}

export async function getLiabilityForUser(db: DbClient, userId: number, id: number) {
  return db.liability.findFirst({
    where: { id, userId },
    include: { account: { select: { id: true, name: true } } },
  });
}

export async function createUserLiability(db: DbClient, userId: number, input: LiabilityInput) {
  if (!input.name.trim()) throw badRequest("name is required");
  if (!Number.isFinite(input.balance) || input.balance < 0) {
    throw badRequest("balance must be >= 0");
  }
  await assertAccountOptional(db, userId, input.accountId);
  return db.liability.create({
    data: {
      userId,
      name: input.name.trim(),
      liabilityType: input.liabilityType,
      balance: input.balance,
      currency: normalizeCurrency(input.currency),
      accountId: input.accountId ?? null,
    },
    include: { account: { select: { id: true, name: true } } },
  });
}

export async function updateUserLiability(
  db: DbClient,
  userId: number,
  id: number,
  input: Partial<LiabilityInput>,
) {
  const existing = await getLiabilityForUser(db, userId, id);
  if (!existing) throw badRequest("Liability not found");
  if (input.accountId !== undefined) await assertAccountOptional(db, userId, input.accountId);

  return db.liability.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.liabilityType != null ? { liabilityType: input.liabilityType } : {}),
      ...(input.balance != null ? { balance: input.balance } : {}),
      ...(input.currency != null ? { currency: normalizeCurrency(input.currency) } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
    },
    include: { account: { select: { id: true, name: true } } },
  });
}

export async function deleteUserLiability(db: DbClient, userId: number, id: number): Promise<void> {
  const existing = await getLiabilityForUser(db, userId, id);
  if (!existing) throw badRequest("Liability not found");
  await db.liability.delete({ where: { id } });
}

export async function sumUserLiabilitiesInCurrency(
  db: DbClient,
  userId: number,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<number> {
  const rows = await db.liability.findMany({ where: { userId } });
  let total = 0;
  for (const row of rows) {
    total += convertAmount(Number(row.balance), row.currency, displayCurrency, plnPerUnit);
  }
  return total;
}

export function serializeLiability(row: {
  id: number;
  name: string;
  liabilityType: string;
  balance: unknown;
  currency: string;
  accountId: number | null;
  createdAt: Date;
  updatedAt: Date;
  account?: { id: number; name: string } | null;
}) {
  return {
    id: row.id,
    name: row.name,
    liabilityType: row.liabilityType,
    balance: Number(row.balance),
    currency: row.currency,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
