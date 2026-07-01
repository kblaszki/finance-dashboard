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

function safeJsonParse(raw: string | null): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
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
    before: safeJsonParse(row.beforeJson),
    after: safeJsonParse(row.afterJson),
    createdAt: row.createdAt.toISOString(),
  };
}
