import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest, notFound } from "./routes/httpSupport";
import { normalizeCurrency } from "./fx";
import { toNumber } from "./accountValuation";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const TAX_WRAPPER_TYPES = ["standard", "ike", "ikze", "ppk"] as const;
export type TaxWrapperType = (typeof TAX_WRAPPER_TYPES)[number];

export const WITHDRAWAL_TYPES = ["partial", "full", "securities_transfer"] as const;
export type WithdrawalType = (typeof WITHDRAWAL_TYPES)[number];

const WRAPPER_SET = new Set<string>(TAX_WRAPPER_TYPES);
const WITHDRAWAL_SET = new Set<string>(WITHDRAWAL_TYPES);
const ADVANTAGED = new Set<TaxWrapperType>(["ike", "ikze", "ppk"]);

export function parseTaxWrapperType(value: unknown): TaxWrapperType {
  const raw = String(value ?? "standard").trim().toLowerCase();
  if (!WRAPPER_SET.has(raw)) {
    throw badRequest(`Invalid taxWrapperType: ${raw}`);
  }
  return raw as TaxWrapperType;
}

export function parseWithdrawalType(value: unknown): WithdrawalType {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!WITHDRAWAL_SET.has(raw)) {
    throw badRequest(`Invalid withdrawalType: ${raw}`);
  }
  return raw as WithdrawalType;
}

export function isTaxAdvantagedWrapper(type: string): boolean {
  return ADVANTAGED.has(type.trim().toLowerCase() as TaxWrapperType);
}

export function accountIncludedInPit38(
  taxWrapperType: string,
  withdrawalsInYear: Array<{ includeInPit38: boolean }>,
): boolean {
  if (!isTaxAdvantagedWrapper(taxWrapperType)) return true;
  return withdrawalsInYear.some((row) => row.includeInPit38);
}

export type TaxWrapperWithdrawalInput = {
  accountId: number;
  withdrawnOn: Date;
  amount: number;
  currency: string;
  withdrawalType: WithdrawalType;
  includeInPit38?: boolean;
  description?: string | null;
};

export type IkzeContributionInput = {
  accountId: number;
  taxYear: number;
  amount: number;
  currency: string;
  contributedOn: Date;
};

export function serializeTaxWrapperWithdrawal(row: {
  id: number;
  accountId: number;
  withdrawnOn: Date;
  amount: unknown;
  currency: string;
  withdrawalType: string;
  includeInPit38: boolean;
  description: string | null;
  createdAt: Date;
  account?: { name: string };
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    withdrawnOn: row.withdrawnOn.toISOString(),
    amount: toNumber(row.amount),
    currency: row.currency,
    withdrawalType: row.withdrawalType,
    includeInPit38: row.includeInPit38,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeIkzeContribution(row: {
  id: number;
  accountId: number;
  taxYear: number;
  amount: unknown;
  currency: string;
  contributedOn: Date;
  createdAt: Date;
  account?: { name: string };
}) {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: row.account?.name ?? null,
    taxYear: row.taxYear,
    amount: toNumber(row.amount),
    currency: row.currency,
    contributedOn: row.contributedOn.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertBrokerageAccount(
  db: DbClient,
  userId: number,
  accountId: number,
): Promise<{ id: number; name: string; taxWrapperType: string }> {
  const account = await db.account.findFirst({
    where: { id: accountId, userId },
    select: { id: true, name: true, accountType: true, taxWrapperType: true },
  });
  if (!account) throw notFound("Account not found");
  if (account.accountType !== "BROKERAGE") {
    throw badRequest("Tax wrapper settings apply to brokerage accounts");
  }
  return account;
}

export async function listTaxWrapperWithdrawals(
  db: DbClient,
  userId: number,
  filters?: { accountId?: number; from?: Date; to?: Date },
) {
  return db.taxWrapperWithdrawal.findMany({
    where: {
      userId,
      ...(filters?.accountId ? { accountId: filters.accountId } : {}),
      ...(filters?.from || filters?.to
        ? {
            withdrawnOn: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: { account: { select: { name: true } } },
    orderBy: [{ withdrawnOn: "desc" }, { id: "desc" }],
  });
}

export async function createTaxWrapperWithdrawal(
  db: DbClient,
  userId: number,
  input: TaxWrapperWithdrawalInput,
) {
  await assertBrokerageAccount(db, userId, input.accountId);
  const data: Prisma.TaxWrapperWithdrawalCreateInput = {
    user: { connect: { id: userId } },
    account: { connect: { id: input.accountId } },
    withdrawnOn: input.withdrawnOn,
    amount: input.amount,
    currency: normalizeCurrency(input.currency),
    withdrawalType: input.withdrawalType,
    includeInPit38: input.includeInPit38 ?? true,
    description: input.description ?? null,
  };
  const row = await db.taxWrapperWithdrawal.create({
    data,
    include: { account: { select: { name: true } } },
  });
  return row;
}

export async function deleteTaxWrapperWithdrawal(db: DbClient, userId: number, id: number) {
  const existing = await db.taxWrapperWithdrawal.findFirst({ where: { id, userId } });
  if (!existing) throw notFound("Withdrawal not found");
  await db.taxWrapperWithdrawal.delete({ where: { id } });
}

export async function listIkzeContributions(
  db: DbClient,
  userId: number,
  filters?: { accountId?: number; taxYear?: number },
) {
  return db.ikzeContribution.findMany({
    where: {
      userId,
      ...(filters?.accountId ? { accountId: filters.accountId } : {}),
      ...(filters?.taxYear != null ? { taxYear: filters.taxYear } : {}),
    },
    include: { account: { select: { name: true } } },
    orderBy: [{ taxYear: "desc" }, { contributedOn: "desc" }],
  });
}

export async function createIkzeContribution(db: DbClient, userId: number, input: IkzeContributionInput) {
  const account = await assertBrokerageAccount(db, userId, input.accountId);
  if (account.taxWrapperType !== "ikze") {
    throw badRequest("IKZE contributions require an IKZE account");
  }
  if (!Number.isInteger(input.taxYear) || input.taxYear < 2000 || input.taxYear > 2100) {
    throw badRequest("taxYear must be between 2000 and 2100");
  }
  const row = await db.ikzeContribution.create({
    data: {
      userId,
      accountId: input.accountId,
      taxYear: input.taxYear,
      amount: input.amount,
      currency: normalizeCurrency(input.currency),
      contributedOn: input.contributedOn,
    },
    include: { account: { select: { name: true } } },
  });
  return row;
}

export async function deleteIkzeContribution(db: DbClient, userId: number, id: number) {
  const existing = await db.ikzeContribution.findFirst({ where: { id, userId } });
  if (!existing) throw notFound("IKZE contribution not found");
  await db.ikzeContribution.delete({ where: { id } });
}

export async function fetchWithdrawalsForTaxYear(
  db: DbClient,
  userId: number,
  taxYear: number,
): Promise<Map<number, Array<{ includeInPit38: boolean }>>> {
  const start = new Date(Date.UTC(taxYear, 0, 1));
  const end = new Date(Date.UTC(taxYear, 11, 31, 23, 59, 59, 999));
  const rows = await db.taxWrapperWithdrawal.findMany({
    where: { userId, withdrawnOn: { gte: start, lte: end } },
    select: { accountId: true, includeInPit38: true },
  });
  const byAccount = new Map<number, Array<{ includeInPit38: boolean }>>();
  for (const row of rows) {
    const list = byAccount.get(row.accountId) ?? [];
    list.push({ includeInPit38: row.includeInPit38 });
    byAccount.set(row.accountId, list);
  }
  return byAccount;
}
