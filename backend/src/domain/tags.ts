import type { Prisma, PrismaClient, Tag } from "@prisma/client";
import { badRequest, notFound } from "../lib/errors";

type Db = PrismaClient | Prisma.TransactionClient;

export function tagNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function parseTagName(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) throw badRequest("name required");
  if (text.length > 80) throw badRequest("name must be at most 80 characters");
  return text;
}

export function tagPayload(tag: Tag) {
  return {
    id: tag.id,
    name: tag.name,
    createdAt: tag.createdAt.toISOString(),
  };
}

export async function findOwnedTag(db: Db, userId: number, id: number): Promise<Tag> {
  const tag = await db.tag.findFirst({ where: { id, userId } });
  if (!tag) throw notFound("Tag not found");
  return tag;
}

export async function assertTagNameUnique(
  db: Db,
  userId: number,
  name: string,
  excludeId?: number,
): Promise<void> {
  const key = tagNameKey(name);
  const existing = await db.tag.findFirst({
    where: {
      userId,
      nameKey: key,
      ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw badRequest("A tag with this name already exists");
  }
}

/** Deduplicate, validate positive ints, assert all owned by user. */
export async function assertOwnedTagIds(
  db: Db,
  userId: number,
  tagIds: number[],
): Promise<number[]> {
  const unique = [...new Set(tagIds)];
  if (unique.length === 0) return [];
  for (const id of unique) {
    if (!Number.isInteger(id) || id < 1) {
      throw badRequest("tagIds must be valid ids");
    }
  }
  const found = await db.tag.findMany({
    where: { userId, id: { in: unique } },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw notFound("Tag not found");
  }
  return unique.sort((a, b) => a - b);
}

export function parseOptionalTagIds(value: unknown): number[] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) {
    throw badRequest("tagIds must be an array");
  }
  const ids: number[] = [];
  for (const item of value) {
    const n = Number(item);
    if (!Number.isInteger(n) || n < 1) {
      throw badRequest("tagIds must be valid ids");
    }
    ids.push(n);
  }
  return ids;
}

/** Replace all tags on a cash transaction (delete + recreate). */
export async function setTransactionTags(
  db: Db,
  cashTransactionId: number,
  tagIds: number[],
): Promise<void> {
  await db.cashTransactionTag.deleteMany({ where: { cashTransactionId } });
  if (tagIds.length === 0) return;
  await db.cashTransactionTag.createMany({
    data: tagIds.map((tagId) => ({ cashTransactionId, tagId })),
  });
}

export async function loadTagIdsForTransactions(
  db: Db,
  cashTransactionIds: number[],
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  for (const id of cashTransactionIds) map.set(id, []);
  if (cashTransactionIds.length === 0) return map;
  const rows = await db.cashTransactionTag.findMany({
    where: { cashTransactionId: { in: cashTransactionIds } },
    select: { cashTransactionId: true, tagId: true },
    orderBy: { tagId: "asc" },
  });
  for (const row of rows) {
    const list = map.get(row.cashTransactionId) ?? [];
    list.push(row.tagId);
    map.set(row.cashTransactionId, list);
  }
  return map;
}
