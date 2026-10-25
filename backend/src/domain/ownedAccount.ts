import type { Account, Prisma, PrismaClient } from "@prisma/client";
import { notFound } from "../lib/errors";

type Db = PrismaClient | Prisma.TransactionClient;

/** Load an account owned by `userId`, or throw 404. */
export async function findOwnedAccount(
  db: Db,
  userId: number,
  accountId: number,
): Promise<Account> {
  const account = await db.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw notFound("Account not found");
  return account;
}

export async function findOwnedAccountId(
  db: Db,
  userId: number,
  accountId: number,
): Promise<number> {
  const account = await findOwnedAccount(db, userId, accountId);
  return account.id;
}
