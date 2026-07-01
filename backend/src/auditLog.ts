import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type AuditAction = "create" | "update" | "delete";

export type AuditEntityType = "transaction" | "asset_trade" | "internal_transfer";

function snapshotJson(value: unknown): string | null {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export async function writeAuditLog(
  db: DbClient,
  userId: number,
  entityType: AuditEntityType,
  entityId: number,
  action: AuditAction,
  before: unknown,
  after: unknown,
): Promise<void> {
  await db.auditLog.create({
    data: {
      userId,
      entityType,
      entityId,
      action,
      beforeJson: snapshotJson(before),
      afterJson: snapshotJson(after),
    },
  });
}

export async function listAuditLogs(
  db: DbClient,
  userId: number,
  filters?: { entityType?: string; limit?: number },
) {
  const limit = Math.min(500, Math.max(1, filters?.limit ?? 100));
  return db.auditLog.findMany({
    where: {
      userId,
      ...(filters?.entityType ? { entityType: filters.entityType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function serializeAuditLog(row: {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    before: row.beforeJson ? JSON.parse(row.beforeJson) : null,
    after: row.afterJson ? JSON.parse(row.afterJson) : null,
    createdAt: row.createdAt.toISOString(),
  };
}
