import type { Prisma, PrismaClient } from "@prisma/client";
import { badRequest, notFound } from "./routes/httpSupport";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ImportPresetDefinition = {
  id: string;
  name: string;
  broker: string;
  targetType: "cash_flow" | "asset_transaction" | "income_event";
  columnMapping: Record<string, string>;
  builtin: boolean;
};

export const BUILTIN_IMPORT_PRESETS: ImportPresetDefinition[] = [
  {
    id: "builtin-mbank-bank",
    name: "mBank bank CSV",
    broker: "mbank",
    targetType: "cash_flow",
    columnMapping: { date: "Data operacji", amount: "Kwota", description: "Opis" },
    builtin: true,
  },
  {
    id: "builtin-xtb-trades",
    name: "XTB trades",
    broker: "xtb",
    targetType: "asset_transaction",
    columnMapping: { date: "Time", symbol: "Symbol", side: "Type", quantity: "Volume", price: "Price" },
    builtin: true,
  },
  {
    id: "builtin-ibkr-trades",
    name: "IBKR trades",
    broker: "ibkr",
    targetType: "asset_transaction",
    columnMapping: { date: "Date/Time", symbol: "Symbol", side: "Buy/Sell", quantity: "Quantity", price: "Price" },
    builtin: true,
  },
  {
    id: "builtin-revolut-bank",
    name: "Revolut bank CSV",
    broker: "revolut",
    targetType: "cash_flow",
    columnMapping: { date: "Completed Date", amount: "Amount", description: "Description" },
    builtin: true,
  },
  {
    id: "builtin-binance-trades",
    name: "Binance trades",
    broker: "binance",
    targetType: "asset_transaction",
    columnMapping: { date: "Date(UTC)", symbol: "Market", side: "Type", quantity: "Amount", price: "Price" },
    builtin: true,
  },
];

export function serializeImportPreset(row: {
  id: number;
  name: string;
  broker: string;
  targetType: string;
  columnMapping: string;
  createdAt: Date;
}) {
  let columnMapping: Record<string, string> = {};
  try {
    columnMapping = JSON.parse(row.columnMapping) as Record<string, string>;
  } catch {
    columnMapping = {};
  }
  return {
    id: row.id,
    name: row.name,
    broker: row.broker,
    targetType: row.targetType,
    columnMapping,
    builtin: false,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listImportPresets(db: DbClient, userId: number) {
  const custom = await db.importPreset.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
  return {
    builtin: BUILTIN_IMPORT_PRESETS,
    custom: custom.map(serializeImportPreset),
  };
}

export async function createImportPreset(
  db: DbClient,
  userId: number,
  input: {
    name: string;
    broker: string;
    targetType: string;
    columnMapping: Record<string, string>;
  },
) {
  if (!input.name.trim()) throw badRequest("name required");
  if (!input.broker.trim()) throw badRequest("broker required");
  const targetType = input.targetType.trim().toLowerCase();
  if (!["cash_flow", "asset_transaction", "income_event"].includes(targetType)) {
    throw badRequest("Invalid targetType");
  }
  return db.importPreset.create({
    data: {
      userId,
      name: input.name.trim(),
      broker: input.broker.trim().toLowerCase(),
      targetType,
      columnMapping: JSON.stringify(input.columnMapping ?? {}),
    },
  });
}

export async function deleteImportPreset(db: DbClient, userId: number, id: number) {
  const row = await db.importPreset.findFirst({ where: { id, userId } });
  if (!row) throw notFound("Import preset not found");
  await db.importPreset.delete({ where: { id } });
}
