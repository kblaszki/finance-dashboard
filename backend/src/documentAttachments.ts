import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest, notFound } from "./routes/httpSupport";

type DbClient = PrismaClient | Prisma.TransactionClient;

const ENTITY_TYPES = new Set(["property_cash_flow", "transaction", "income_event"]);

export type DocumentAttachmentInput = {
  entityType: string;
  entityId: number;
  filename: string;
  mimeType?: string | null;
  storageRef?: string | null;
  description?: string | null;
};

export function serializeDocumentAttachment(row: {
  id: number;
  entityType: string;
  entityId: number;
  filename: string;
  mimeType: string | null;
  storageRef: string | null;
  description: string | null;
  uploadedAt: Date;
}) {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    filename: row.filename,
    mimeType: row.mimeType,
    storageRef: row.storageRef,
    description: row.description,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export async function listDocumentAttachments(
  db: DbClient,
  userId: number,
  filters?: { entityType?: string; entityId?: number },
) {
  return db.documentAttachment.findMany({
    where: {
      userId,
      ...(filters?.entityType ? { entityType: filters.entityType } : {}),
      ...(filters?.entityId != null ? { entityId: filters.entityId } : {}),
    },
    orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
  });
}

export async function createDocumentAttachment(
  db: DbClient,
  userId: number,
  input: DocumentAttachmentInput,
) {
  const entityType = String(input.entityType).trim().toLowerCase();
  if (!ENTITY_TYPES.has(entityType)) {
    throw badRequest(`Invalid entityType: ${entityType}`);
  }
  if (!input.filename.trim()) {
    throw badRequest("filename required");
  }
  return db.documentAttachment.create({
    data: {
      userId,
      entityType,
      entityId: input.entityId,
      filename: input.filename.trim(),
      mimeType: input.mimeType ?? null,
      storageRef: input.storageRef ?? null,
      description: input.description ?? null,
    },
  });
}

export async function deleteDocumentAttachment(db: DbClient, userId: number, id: number) {
  const row = await db.documentAttachment.findFirst({ where: { id, userId } });
  if (!row) throw notFound("Attachment not found");
  await db.documentAttachment.delete({ where: { id } });
}
