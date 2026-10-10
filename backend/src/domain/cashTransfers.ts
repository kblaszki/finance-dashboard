import type { CashTransfer, Prisma, PrismaClient } from "@prisma/client";
import { badRequest, notFound } from "../lib/errors";
import {
  parsePositiveAmount,
  postCashTransaction,
  reverseCashTransaction,
} from "./cashLedger";
import { decimalToMinor, minorToDecimal, minorToMajor } from "./money";

type Db = PrismaClient | Prisma.TransactionClient;

export type OwnedAccountRef = {
  id: number;
  currency: string;
};

export type TransferInput = {
  fromAccountId: number;
  toAccountId: number;
  amountFrom: Prisma.Decimal;
  amountTo: Prisma.Decimal;
  occurredAt: Date;
  description: string | null;
};

export type TransferWithAccounts = CashTransfer & {
  fromAccount: { id: number; currency: string; name: string };
  toAccount: { id: number; currency: string; name: string };
};

function parseOccurredAt(value: unknown): Date {
  if (value === undefined || value === null || value === "") {
    return new Date();
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw badRequest("occurredAt must be a valid date");
  }
  return date;
}

function parseOptionalDescription(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text.length > 500) throw badRequest("description must be at most 500 characters");
  return text.length ? text : null;
}

/**
 * Resolve create/update transfer fields against owned accounts.
 * Same currency: amountTo optional (defaults to amountFrom); mismatch → 400.
 * Cross currency: amountTo required.
 */
export function parseTransferInput(
  body: Record<string, unknown>,
  accountsById: Map<number, OwnedAccountRef>,
  existing?: TransferInput,
): TransferInput {
  const fromAccountId =
    body.fromAccountId !== undefined
      ? Number(body.fromAccountId)
      : existing?.fromAccountId;
  const toAccountId =
    body.toAccountId !== undefined ? Number(body.toAccountId) : existing?.toAccountId;

  if (fromAccountId === undefined || toAccountId === undefined) {
    throw badRequest("fromAccountId and toAccountId required");
  }
  if (!Number.isInteger(fromAccountId) || fromAccountId < 1) {
    throw badRequest("fromAccountId must be a valid id");
  }
  if (!Number.isInteger(toAccountId) || toAccountId < 1) {
    throw badRequest("toAccountId must be a valid id");
  }
  if (fromAccountId === toAccountId) {
    throw badRequest("fromAccountId and toAccountId must be different");
  }

  const from = accountsById.get(fromAccountId);
  const to = accountsById.get(toAccountId);
  if (!from || !to) throw notFound("Account not found");

  const amountFrom =
    body.amountFrom !== undefined
      ? parsePositiveAmount(body.amountFrom)
      : existing?.amountFrom;
  if (amountFrom === undefined) throw badRequest("amountFrom required");

  let amountTo: Prisma.Decimal;
  if (from.currency === to.currency) {
    if (body.amountTo !== undefined && body.amountTo !== null && body.amountTo !== "") {
      amountTo = parsePositiveAmount(body.amountTo);
      if (!amountTo.equals(amountFrom)) {
        throw badRequest("amountTo must equal amountFrom when currencies match");
      }
    } else if (existing && body.amountFrom === undefined) {
      amountTo = existing.amountTo;
    } else {
      amountTo = amountFrom;
    }
  } else if (body.amountTo !== undefined && body.amountTo !== null && body.amountTo !== "") {
    amountTo = parsePositiveAmount(body.amountTo);
  } else if (existing && body.fromAccountId === undefined && body.toAccountId === undefined) {
    // Keep prior amountTo when only patching non-account fields on a cross-currency transfer.
    if (body.amountFrom !== undefined) {
      throw badRequest("amountTo required when currencies differ");
    }
    amountTo = existing.amountTo;
  } else {
    throw badRequest("amountTo required when currencies differ");
  }

  const occurredAt =
    body.occurredAt !== undefined
      ? parseOccurredAt(body.occurredAt)
      : (existing?.occurredAt ?? new Date());
  const description =
    body.description !== undefined
      ? parseOptionalDescription(body.description)
      : (existing?.description ?? null);

  return {
    fromAccountId,
    toAccountId,
    amountFrom,
    amountTo,
    occurredAt,
    description,
  };
}

export async function createTransfer(
  db: Db,
  userId: number,
  input: TransferInput,
): Promise<TransferWithAccounts> {
  const header = await db.cashTransfer.create({
    data: {
      userId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amountFrom: decimalToMinor(input.amountFrom, "amountFrom"),
      amountTo: decimalToMinor(input.amountTo, "amountTo"),
      occurredAt: input.occurredAt,
      description: input.description,
    },
  });

  await postCashTransaction(db, {
    accountId: input.fromAccountId,
    type: "TRANSFER_OUT",
    amount: input.amountFrom,
    occurredAt: input.occurredAt,
    description: input.description,
    categoryId: null,
    transferId: header.id,
  });
  await postCashTransaction(db, {
    accountId: input.toAccountId,
    type: "TRANSFER_IN",
    amount: input.amountTo,
    occurredAt: input.occurredAt,
    description: input.description,
    categoryId: null,
    transferId: header.id,
  });

  return findOwnedTransfer(db, userId, header.id);
}

export async function updateTransfer(
  db: Db,
  userId: number,
  existing: TransferWithAccounts,
  input: TransferInput,
): Promise<TransferWithAccounts> {
  const legs = await db.cashTransaction.findMany({
    where: { transferId: existing.id },
    select: { id: true, accountId: true, type: true, amount: true },
  });
  for (const leg of legs) {
    await reverseCashTransaction(db, leg.accountId, leg);
  }

  await db.cashTransfer.update({
    where: { id: existing.id },
    data: {
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amountFrom: decimalToMinor(input.amountFrom, "amountFrom"),
      amountTo: decimalToMinor(input.amountTo, "amountTo"),
      occurredAt: input.occurredAt,
      description: input.description,
    },
  });

  await postCashTransaction(db, {
    accountId: input.fromAccountId,
    type: "TRANSFER_OUT",
    amount: input.amountFrom,
    occurredAt: input.occurredAt,
    description: input.description,
    categoryId: null,
    transferId: existing.id,
  });
  await postCashTransaction(db, {
    accountId: input.toAccountId,
    type: "TRANSFER_IN",
    amount: input.amountTo,
    occurredAt: input.occurredAt,
    description: input.description,
    categoryId: null,
    transferId: existing.id,
  });

  return findOwnedTransfer(db, userId, existing.id);
}

export async function deleteTransfer(db: Db, existing: TransferWithAccounts): Promise<void> {
  const legs = await db.cashTransaction.findMany({
    where: { transferId: existing.id },
    select: { id: true, accountId: true, type: true, amount: true },
  });
  for (const leg of legs) {
    await reverseCashTransaction(db, leg.accountId, leg);
  }
  await db.cashTransfer.delete({ where: { id: existing.id } });
}

export async function findOwnedTransfer(
  db: Db,
  userId: number,
  id: number,
): Promise<TransferWithAccounts> {
  const row = await db.cashTransfer.findFirst({
    where: { id, userId },
    include: {
      fromAccount: { select: { id: true, currency: true, name: true } },
      toAccount: { select: { id: true, currency: true, name: true } },
    },
  });
  if (!row) throw notFound("Transfer not found");
  return row;
}

export function transferPayload(transfer: TransferWithAccounts) {
  const amountFrom = minorToMajor(transfer.amountFrom);
  const amountTo = minorToMajor(transfer.amountTo);
  return {
    id: transfer.id,
    fromAccountId: transfer.fromAccountId,
    toAccountId: transfer.toAccountId,
    fromCurrency: transfer.fromAccount.currency,
    toCurrency: transfer.toAccount.currency,
    amountFrom,
    amountTo,
    fxRate: amountFrom === 0 ? null : amountTo / amountFrom,
    occurredAt: transfer.occurredAt.toISOString(),
    description: transfer.description,
    createdAt: transfer.createdAt.toISOString(),
  };
}

export function transferInputFromExisting(existing: TransferWithAccounts): TransferInput {
  return {
    fromAccountId: existing.fromAccountId,
    toAccountId: existing.toAccountId,
    amountFrom: minorToDecimal(existing.amountFrom),
    amountTo: minorToDecimal(existing.amountTo),
    occurredAt: existing.occurredAt,
    description: existing.description,
  };
}
