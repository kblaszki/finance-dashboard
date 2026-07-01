import type { Prisma, PrismaClient } from "@prisma/client";
import { recalcTransactionBalances, recomputeAccountValuationsFrom } from "./accountValuation";
import { revalueManualAccount } from "./manualAccountRevalue";
import { badRequest } from "./routes/httpSupport";
import { normalizeCurrency } from "./fx";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const ASSET_VALUATION_ACCOUNT_TYPES = new Set([
  "REAL_ESTATE",
  "MANUAL",
  "OTHER",
  "PRECIOUS_METAL",
]);

export type AssetValuationInput = {
  accountId?: number | null;
  instrumentId?: number | null;
  valuedOn: Date;
  value: number;
  currency: string;
  source?: string;
  description?: string | null;
};

export async function listAssetValuations(
  db: DbClient,
  userId: number,
  filters?: { accountId?: number; instrumentId?: number; from?: Date; to?: Date },
) {
  return db.assetValuation.findMany({
    where: {
      userId,
      ...(filters?.accountId ? { accountId: filters.accountId } : {}),
      ...(filters?.instrumentId ? { instrumentId: filters.instrumentId } : {}),
      ...(filters?.from || filters?.to
        ? {
            valuedOn: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: {
      account: { select: { id: true, name: true } },
      instrument: { select: { id: true, symbol: true } },
    },
    orderBy: [{ valuedOn: "desc" }, { id: "desc" }],
  });
}

export async function getAssetValuationForUser(db: DbClient, userId: number, id: number) {
  return db.assetValuation.findFirst({
    where: { id, userId },
    include: {
      account: { select: { id: true, name: true } },
      instrument: { select: { id: true, symbol: true } },
    },
  });
}

async function assertAccountForValuation(db: DbClient, userId: number, accountId: number) {
  const account = await db.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw badRequest("Invalid accountId");
  if (!ASSET_VALUATION_ACCOUNT_TYPES.has(account.accountType)) {
    throw badRequest("Asset valuations for this account type use holdings or market prices");
  }
  return account;
}

async function assertInstrumentOptional(db: DbClient, instrumentId: number | null | undefined) {
  if (instrumentId == null) return;
  const instrument = await db.instrument.findUnique({ where: { id: instrumentId } });
  if (!instrument) throw badRequest("Invalid instrumentId");
}

export async function createAssetValuation(
  db: PrismaClient,
  userId: number,
  input: AssetValuationInput,
  plnPerUnit: Record<string, number>,
) {
  if (input.accountId == null && input.instrumentId == null) {
    throw badRequest("accountId or instrumentId is required");
  }
  if (!Number.isFinite(input.value) || input.value < 0) {
    throw badRequest("value must be non-negative");
  }

  const currency = normalizeCurrency(input.currency);
  let account: Awaited<ReturnType<typeof assertAccountForValuation>> | null = null;
  if (input.accountId != null) {
    account = await assertAccountForValuation(db, userId, input.accountId);
  }
  await assertInstrumentOptional(db, input.instrumentId);

  const row = await db.assetValuation.create({
    data: {
      userId,
      accountId: input.accountId ?? null,
      instrumentId: input.instrumentId ?? null,
      valuedOn: input.valuedOn,
      value: input.value,
      currency,
      source: input.source?.trim() || "manual",
      description: input.description?.trim() || null,
    },
    include: {
      account: { select: { id: true, name: true } },
      instrument: { select: { id: true, symbol: true } },
    },
  });

  if (account) {
    await revalueManualAccount(db, account, input.value, input.valuedOn, plnPerUnit, {
      recalcTransactionBalances,
      recomputeAccountValuationsFrom,
    });
  }

  return row;
}

export async function deleteAssetValuation(db: DbClient, userId: number, id: number): Promise<void> {
  const existing = await getAssetValuationForUser(db, userId, id);
  if (!existing) throw badRequest("Asset valuation not found");
  await db.assetValuation.delete({ where: { id } });
}

export function serializeAssetValuation(row: {
  id: number;
  accountId: number | null;
  instrumentId: number | null;
  valuedOn: Date;
  value: unknown;
  currency: string;
  source: string;
  description: string | null;
  createdAt: Date;
  account?: { id: number; name: string } | null;
  instrument?: { id: number; symbol: string } | null;
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    instrumentId: row.instrumentId,
    instrumentSymbol: row.instrument?.symbol ?? null,
    valuedOn: row.valuedOn.toISOString(),
    value: Number(row.value),
    currency: row.currency,
    source: row.source,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}
