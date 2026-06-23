import type { Prisma, PrismaClient } from "@prisma/client";
import type { BrokerId, ImportResult, ParsedImportRow } from "./types";
import { parseXtbCsv } from "./xtbParser";
import { rowExternalHash, toPreviewRow } from "./normalizeTrade";
import { findOrCreateHolding, recalcLotQuantityChain, syncHoldingQuantity } from "../holdings";
import { recomputeQuantityAfterChain } from "../holdingLot";
import {
  recalcTransactionBalances,
  recomputeAccountValuationsFrom,
  syncBrokerageCashBalance,
  toNumber,
} from "../accountValuation";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ImportTradesInput = {
  accountId: number;
  userId: number;
  broker: BrokerId;
  csvText: string;
  filename?: string;
  dryRun: boolean;
  plnPerUnit: Record<string, number>;
};

function parseBrokerCsv(broker: BrokerId, csvText: string, accountCurrency: string) {
  if (broker === "xtb") {
    return parseXtbCsv(csvText, accountCurrency);
  }
  throw new Error(`Unsupported broker: ${broker}`);
}

async function resolveInstrument(
  db: DbClient,
  symbol: string,
  exchange: string | null,
  currency: string,
) {
  const existing = await db.instrument.findFirst({
    where: {
      symbol,
      exchange: exchange ?? null,
      source: "manual",
    },
  });
  if (existing) return existing;

  return db.instrument.create({
    data: {
      symbol,
      exchange,
      currency,
      instrumentType: "STOCK",
      source: "manual",
    },
  });
}

async function importTradeRow(
  db: DbClient,
  accountId: number,
  row: Extract<ParsedImportRow, { kind: "trade" }>,
): Promise<{ holdingLotId: number; earliestDate: Date }> {
  const instrument = await resolveInstrument(db, row.symbol, row.exchange, row.currency);
  const holding = await findOrCreateHolding(db, accountId, instrument.id);

  const existingLots = await db.holdingLot.findMany({
    where: { holdingId: holding.id },
    orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
  });
  recomputeQuantityAfterChain([
    ...existingLots.map((lot) => ({
      id: lot.id,
      side: lot.side,
      quantity: toNumber(lot.quantity),
      tradeDate: lot.tradeDate,
    })),
    { id: -1, side: row.side, quantity: row.quantity, tradeDate: row.tradeDate },
  ]);

  const created = await db.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: row.side,
      quantity: row.quantity,
      quantityAfter: 0,
      totalPrice: row.totalPrice,
      pricePerUnit: row.pricePerUnit,
      currency: row.currency,
      tradeDate: row.tradeDate,
    },
  });

  await recalcLotQuantityChain(db, holding.id);
  await syncHoldingQuantity(db, holding.id);

  if (row.fee != null && row.fee > 0) {
    await db.transaction.create({
      data: {
        accountId,
        transactionType: "EXPENSE",
        amount: row.fee,
        balanceAfter: 0,
        currency: row.currency,
        category: "COMMISSION",
        date: row.tradeDate,
        description: `Import fee ${row.symbol}`,
      },
    });
  }

  return { holdingLotId: created.id, earliestDate: row.tradeDate };
}

async function importCashRow(
  db: DbClient,
  accountId: number,
  row: Exclude<ParsedImportRow, { kind: "trade" }>,
): Promise<{ transactionId: number; date: Date }> {
  const typeMap = {
    dividend: "DIVIDEND",
    interest: "INTEREST",
    transfer_in: "TRANSFER_IN",
    transfer_out: "TRANSFER_OUT",
  } as const;
  const categoryMap = {
    dividend: "DIVIDEND",
    interest: "INTEREST",
    transfer_in: "TRANSFER",
    transfer_out: "TRANSFER",
  } as const;

  const created = await db.transaction.create({
    data: {
      accountId,
      transactionType: typeMap[row.kind],
      amount: row.amount,
      balanceAfter: 0,
      currency: row.currency,
      category: categoryMap[row.kind],
      date: row.date,
      description: row.description ?? row.symbol ?? null,
    },
  });
  return { transactionId: created.id, date: row.date };
}

export async function importBrokerTrades(
  prisma: PrismaClient,
  input: ImportTradesInput,
): Promise<ImportResult> {
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, userId: input.userId },
  });
  if (!account) {
    throw new Error("Account not found");
  }
  if (account.accountType !== "BROKERAGE") {
    throw new Error("Import is only supported for brokerage accounts");
  }

  const { rows: parsedRows, errors } = parseBrokerCsv(
    input.broker,
    input.csvText,
    account.currency,
  );

  const preview = parsedRows.map(toPreviewRow);
  if (input.dryRun) {
    return {
      dryRun: true,
      parsed: parsedRows.length,
      imported: 0,
      skipped: 0,
      errors,
      preview,
    };
  }

  let imported = 0;
  let skipped = 0;
  let earliestDate: Date | null = null;

  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        accountId: input.accountId,
        broker: input.broker,
        filename: input.filename ?? null,
      },
    });

    for (const row of parsedRows) {
      const hash = rowExternalHash(input.accountId, input.broker, row);
      const existing = await tx.importRow.findUnique({
        where: { accountId_externalHash: { accountId: input.accountId, externalHash: hash } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      try {
        if (row.kind === "trade") {
          const { holdingLotId, earliestDate: tradeDate } = await importTradeRow(
            tx,
            input.accountId,
            row,
          );
          await tx.importRow.create({
            data: {
              batchId: batch.id,
              accountId: input.accountId,
              externalHash: hash,
              holdingLotId,
            },
          });
          if (!earliestDate || tradeDate < earliestDate) earliestDate = tradeDate;
        } else {
          const { transactionId, date } = await importCashRow(tx, input.accountId, row);
          await tx.importRow.create({
            data: {
              batchId: batch.id,
              accountId: input.accountId,
              externalHash: hash,
              transactionId,
            },
          });
          if (!earliestDate || date < earliestDate) earliestDate = date;
        }
        imported++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Import failed";
        errors.push({ row: row.row, message });
      }
    }

    if (earliestDate) {
      await recalcTransactionBalances(tx, input.accountId, earliestDate);
      await syncBrokerageCashBalance(tx, input.accountId);
      await recomputeAccountValuationsFrom(tx, input.accountId, earliestDate, input.plnPerUnit);
    }
  });

  return {
    dryRun: false,
    parsed: parsedRows.length,
    imported,
    skipped,
    errors,
    preview,
  };
}
