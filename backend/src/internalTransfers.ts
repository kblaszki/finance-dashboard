import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { recalcTransactionBalances, recomputeAccountValuationsFrom } from "./accountValuation";
import { convertAmount } from "./fx";
import type { DbClient } from "./routes/routeSupport";
import { notFound } from "./routes/httpSupport";

export const INTERNAL_TRANSFER_CATEGORY = "INTERNAL_TRANSFER";

export type InternalTransferMeta = {
  groupId: string;
  fromAccountId: number;
  toAccountId: number;
  fromAmount: number;
  toAmount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  commission: number;
  note?: string;
};

export type InternalTransfer = InternalTransferMeta & {
  date: string;
  outTransactionId: number;
  inTransactionId: number;
  fromAccountName: string;
  toAccountName: string;
};

export type CreateInternalTransferInput = {
  fromAccountId: number;
  toAccountId: number;
  fromAmount: number;
  toAmount: number;
  exchangeRate?: number;
  commission?: number;
  date: Date;
  note?: string;
};

export function encodeTransferDescription(meta: InternalTransferMeta): string {
  return JSON.stringify(meta);
}

export function parseTransferDescription(value: string | null | undefined): InternalTransferMeta | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<InternalTransferMeta>;
    if (
      typeof parsed.groupId !== "string" ||
      typeof parsed.fromAccountId !== "number" ||
      typeof parsed.toAccountId !== "number" ||
      typeof parsed.fromAmount !== "number" ||
      typeof parsed.toAmount !== "number" ||
      typeof parsed.fromCurrency !== "string" ||
      typeof parsed.toCurrency !== "string" ||
      typeof parsed.exchangeRate !== "number" ||
      typeof parsed.commission !== "number"
    ) {
      return null;
    }
    return parsed as InternalTransferMeta;
  } catch {
    return null;
  }
}

export function validateInternalTransfer(
  fromAccount: { id: number; currency: string },
  toAccount: { id: number; currency: string },
  input: Pick<CreateInternalTransferInput, "fromAmount" | "toAmount" | "exchangeRate" | "commission">,
): string | null {
  if (fromAccount.id === toAccount.id) {
    return "Source and destination accounts must differ";
  }
  if (!Number.isFinite(input.fromAmount) || input.fromAmount <= 0) {
    return "fromAmount must be positive";
  }
  if (!Number.isFinite(input.toAmount) || input.toAmount <= 0) {
    return "toAmount must be positive";
  }

  const commission = input.commission ?? 0;
  if (!Number.isFinite(commission) || commission < 0) {
    return "commission must be zero or positive";
  }

  const sameCurrency = fromAccount.currency === toAccount.currency;
  if (sameCurrency) {
    if (input.toAmount !== input.fromAmount) {
      return "Same-currency transfer requires matching from and to amounts";
    }
    return null;
  }

  if (input.exchangeRate == null || !Number.isFinite(input.exchangeRate) || input.exchangeRate <= 0) {
    return "exchangeRate is required for cross-currency transfers";
  }
  return null;
}

export function suggestCrossCurrencyTransfer(
  fromCurrency: string,
  toCurrency: string,
  fromAmount: number,
  plnPerUnit: Record<string, number>,
): { exchangeRate: number; suggestedToAmount: number } {
  const exchangeRate = convertAmount(1, fromCurrency, toCurrency, plnPerUnit);
  const suggestedToAmount = convertAmount(fromAmount, fromCurrency, toCurrency, plnPerUnit);
  return { exchangeRate, suggestedToAmount };
}

export async function fetchUserInternalTransfers(
  prisma: PrismaClient,
  userId: number,
  filters: { accountId?: number; from?: Date; to?: Date },
): Promise<InternalTransfer[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      transactionType: "TRANSFER_OUT",
      category: INTERNAL_TRANSFER_CATEGORY,
      account: { userId },
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      ...(filters.accountId != null
        ? {
            OR: [{ accountId: filters.accountId }, { description: { contains: `"toAccountId":${filters.accountId}` } }],
          }
        : {}),
    },
    include: {
      account: { select: { id: true, name: true, currency: true } },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });

  const transfers: InternalTransfer[] = [];
  for (const outRow of rows) {
    const meta = parseTransferDescription(outRow.description);
    if (!meta) continue;
    if (filters.accountId != null && meta.fromAccountId !== filters.accountId && meta.toAccountId !== filters.accountId) {
      continue;
    }

    const inRow = await prisma.transaction.findFirst({
      where: {
        transactionType: "TRANSFER_IN",
        category: INTERNAL_TRANSFER_CATEGORY,
        description: outRow.description,
        account: { userId },
      },
      include: { account: { select: { id: true, name: true, currency: true } } },
    });
    if (!inRow) continue;

    transfers.push({
      ...meta,
      date: outRow.date.toISOString(),
      outTransactionId: outRow.id,
      inTransactionId: inRow.id,
      fromAccountName: outRow.account.name,
      toAccountName: inRow.account.name,
    });
  }

  return transfers;
}

type CreateDeps = {
  getAccountForUser: (
    db: DbClient,
    userId: number,
    accountId: number,
  ) => Promise<{ id: number; currency: string; name: string } | null>;
  getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }>;
};

export async function createInternalTransfer(
  prisma: PrismaClient,
  userId: number,
  input: CreateInternalTransferInput,
  deps: CreateDeps,
): Promise<InternalTransfer> {
  const fromAccount = await deps.getAccountForUser(prisma, userId, input.fromAccountId);
  if (!fromAccount) throw notFound("Source account not found");
  const toAccount = await deps.getAccountForUser(prisma, userId, input.toAccountId);
  if (!toAccount) throw notFound("Destination account not found");

  const validationError = validateInternalTransfer(fromAccount, toAccount, input);
  if (validationError) throw new Error(validationError);

  const commission = input.commission ?? 0;
  const sameCurrency = fromAccount.currency === toAccount.currency;
  const exchangeRate = sameCurrency ? 1 : (input.exchangeRate as number);
  const meta: InternalTransferMeta = {
    groupId: randomUUID(),
    fromAccountId: fromAccount.id,
    toAccountId: toAccount.id,
    fromAmount: input.fromAmount,
    toAmount: input.toAmount,
    fromCurrency: fromAccount.currency,
    toCurrency: toAccount.currency,
    exchangeRate,
    commission,
    ...(input.note ? { note: input.note } : {}),
  };
  const description = encodeTransferDescription(meta);
  const outAmount = input.fromAmount + commission;
  const { plnPerUnit } = await deps.getFxRatesPlnPerUnit();

  return prisma.$transaction(async (tx) => {
    const outCreated = await tx.transaction.create({
      data: {
        accountId: fromAccount.id,
        transactionType: "TRANSFER_OUT",
        amount: outAmount,
        balanceAfter: 0,
        currency: fromAccount.currency,
        category: INTERNAL_TRANSFER_CATEGORY,
        date: input.date,
        description,
      },
    });
    await tx.transaction.create({
      data: {
        accountId: toAccount.id,
        transactionType: "TRANSFER_IN",
        amount: input.toAmount,
        balanceAfter: 0,
        currency: toAccount.currency,
        category: INTERNAL_TRANSFER_CATEGORY,
        date: input.date,
        description,
      },
    });

    const recalcFrom = input.date;
    await recalcTransactionBalances(tx, fromAccount.id, recalcFrom);
    await recalcTransactionBalances(tx, toAccount.id, recalcFrom);
    await recomputeAccountValuationsFrom(tx, fromAccount.id, recalcFrom, plnPerUnit);
    await recomputeAccountValuationsFrom(tx, toAccount.id, recalcFrom, plnPerUnit);

    const inRow = await tx.transaction.findFirstOrThrow({
      where: {
        accountId: toAccount.id,
        transactionType: "TRANSFER_IN",
        category: INTERNAL_TRANSFER_CATEGORY,
        description,
      },
    });

    return {
      ...meta,
      date: outCreated.date.toISOString(),
      outTransactionId: outCreated.id,
      inTransactionId: inRow.id,
      fromAccountName: fromAccount.name,
      toAccountName: toAccount.name,
    };
  });
}

export async function deleteInternalTransfer(
  prisma: PrismaClient,
  userId: number,
  groupId: string,
  deps: { getFxRatesPlnPerUnit: () => Promise<{ plnPerUnit: Record<string, number> }> },
): Promise<void> {
  const rows = await prisma.transaction.findMany({
    where: {
      category: INTERNAL_TRANSFER_CATEGORY,
      account: { userId },
      description: { contains: `"groupId":"${groupId}"` },
    },
  });
  if (rows.length === 0) throw notFound("Transfer not found");

  const earliest = rows.reduce(
    (best, row) => (row.date.getTime() < best.getTime() ? row.date : best),
    rows[0]!.date,
  );
  const accountIds = [...new Set(rows.map((row) => row.accountId))];
  const { plnPerUnit } = await deps.getFxRatesPlnPerUnit();

  await prisma.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    for (const accountId of accountIds) {
      await recalcTransactionBalances(tx, accountId, earliest);
      await recomputeAccountValuationsFrom(tx, accountId, earliest, plnPerUnit);
    }
  });
}
