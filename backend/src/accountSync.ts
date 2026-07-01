import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest } from "./routes/httpSupport";
import { syncMarketPrices } from "./marketDataSync";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const SYNC_PROVIDERS = ["stub", "broker_api", "bank_api"] as const;
export type SyncProvider = (typeof SYNC_PROVIDERS)[number];

export type AccountSyncInput = {
  provider?: SyncProvider;
  syncEnabled?: boolean;
  syncIntervalHours?: number;
  configJson?: string | null;
};

async function assertAccountOwned(db: DbClient, userId: number, accountId: number) {
  const account = await db.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw badRequest("Invalid accountId");
  return account;
}

export async function getAccountSyncSetting(db: DbClient, userId: number, accountId: number) {
  await assertAccountOwned(db, userId, accountId);
  return db.accountSyncSetting.findUnique({ where: { accountId } });
}

export async function listAccountSyncSettings(db: DbClient, userId: number) {
  return db.accountSyncSetting.findMany({
    where: { account: { userId } },
    include: { account: { select: { id: true, name: true, accountType: true } } },
    orderBy: { accountId: "asc" },
  });
}

export async function upsertAccountSyncSetting(
  db: DbClient,
  userId: number,
  accountId: number,
  input: AccountSyncInput,
) {
  const account = await assertAccountOwned(db, userId, accountId);

  return db.accountSyncSetting.upsert({
    where: { accountId },
    create: {
      userId,
      accountId,
      provider: input.provider ?? "stub",
      syncEnabled: input.syncEnabled ?? false,
      syncIntervalHours: input.syncIntervalHours ?? 24,
      configJson: input.configJson ?? null,
    },
    update: {
      ...(input.provider != null ? { provider: input.provider } : {}),
      ...(input.syncEnabled != null ? { syncEnabled: input.syncEnabled } : {}),
      ...(input.syncIntervalHours != null ? { syncIntervalHours: input.syncIntervalHours } : {}),
      ...(input.configJson !== undefined ? { configJson: input.configJson } : {}),
    },
    include: { account: { select: { id: true, name: true, accountType: true } } },
  });
}

export async function runAccountSync(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>,
) {
  const account = await assertAccountOwned(prisma, userId, accountId);
  const setting = await prisma.accountSyncSetting.findUnique({ where: { accountId } });
  if (!setting?.syncEnabled) {
    throw badRequest("Sync is not enabled for this account");
  }

  let result: unknown;
  let status = "ok";

  if (account.accountType === "BROKERAGE" || account.accountType === "CRYPTO") {
    result = await syncMarketPrices(prisma, getFxRatesPlnPerUnit, { userId });
  } else if (account.accountType === "BANK") {
    status = "stub";
    result = {
      message:
        "Bank API sync is not configured. Use CSV import (FR-019) or connect via PSD2 (FR-036).",
    };
  } else {
    status = "skipped";
    result = { message: `Account type ${account.accountType} does not support automated sync` };
  }

  const now = new Date();
  await prisma.accountSyncSetting.update({
    where: { accountId },
    data: { lastSyncAt: now, lastSyncStatus: status },
  });

  return { status, syncedAt: now.toISOString(), result };
}

export function serializeAccountSyncSetting(row: {
  id: number;
  accountId: number;
  provider: string;
  syncEnabled: boolean;
  syncIntervalHours: number;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  configJson: string | null;
  createdAt: Date;
  updatedAt: Date;
  account?: { id: number; name: string; accountType: string };
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    accountType: row.account?.accountType ?? null,
    provider: row.provider,
    syncEnabled: row.syncEnabled,
    syncIntervalHours: row.syncIntervalHours,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastSyncStatus: row.lastSyncStatus,
    configJson: row.configJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
