import type { AssetTrade, Prisma, PrismaClient } from "@prisma/client";
import { Prisma as PrismaNS } from "@prisma/client";
import { badRequest, notFound } from "../lib/errors";
import {
  parseLedgerTxType,
  postCashTransaction,
  reverseCashTransaction,
  signedMinor,
} from "./cashLedger";
import { assertAssetTradeAccountType } from "./holdings";
import { resolveHolding, syncHoldingQuantity } from "./holdings";
import {
  closeLotsFifo,
  deleteOpenedLotForTrade,
  openLot,
  reverseLotCloses,
} from "./lots";
import {
  decimalToMinor,
  parseMoneyDecimal,
  parseQuantityDecimal,
} from "./money";

type Db = PrismaClient | Prisma.TransactionClient;

export const ASSET_TRADE_SIDES = ["BUY", "SELL"] as const;
export type AssetTradeSide = (typeof ASSET_TRADE_SIDES)[number];

export type AssetTradeInput = {
  instrumentId: number;
  side: AssetTradeSide;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  commission: Prisma.Decimal;
  occurredAt: Date;
  settlementDate: Date | null;
  notes: string | null;
};

export type OwnedBrokerageAccount = {
  id: number;
  currency: string;
  accountType: string;
  cashBalance: number;
};

export type InstrumentRef = {
  id: number;
  currency: string;
  symbol: string;
};

function parseSide(value: unknown): AssetTradeSide {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!(ASSET_TRADE_SIDES as readonly string[]).includes(raw)) {
    throw badRequest(`side must be one of: ${ASSET_TRADE_SIDES.join(", ")}`);
  }
  return raw as AssetTradeSide;
}

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

function parseOptionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid date`);
  }
  return date;
}

function parseOptionalNotes(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text.length > 500) throw badRequest("notes must be at most 500 characters");
  return text.length ? text : null;
}

function parseCommission(value: unknown): Prisma.Decimal {
  if (value === undefined || value === null || value === "") {
    return new PrismaNS.Decimal(0);
  }
  return parseMoneyDecimal(value, "commission", {
    allowNegative: false,
    allowZero: true,
  });
}

export function parseAssetTradeInput(body: Record<string, unknown>): AssetTradeInput {
  const instrumentId = Number(body.instrumentId);
  if (!Number.isInteger(instrumentId) || instrumentId < 1) {
    throw badRequest("instrumentId must be a valid id");
  }
  return {
    instrumentId,
    side: parseSide(body.side),
    quantity: parseQuantityDecimal(body.quantity),
    unitPrice: parseMoneyDecimal(body.unitPrice, "unitPrice"),
    commission: parseCommission(body.commission),
    occurredAt: parseOccurredAt(body.occurredAt),
    settlementDate: parseOptionalDate(body.settlementDate, "settlementDate"),
    notes: parseOptionalNotes(body.notes),
  };
}

function tradeNotional(
  quantity: Prisma.Decimal,
  unitPrice: Prisma.Decimal,
): Prisma.Decimal {
  return quantity.mul(unitPrice).toDecimalPlaces(2, PrismaNS.Decimal.ROUND_HALF_UP);
}

function moneyMajor(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, PrismaNS.Decimal.ROUND_HALF_UP);
}

/**
 * Apply BUY or SELL inside an existing Prisma transaction.
 * Creates AssetTrade + ASSET_* cash leg + lots/closes; updates cashBalance via postCashTransaction.
 */
export async function applyAssetTrade(
  db: Db,
  account: OwnedBrokerageAccount,
  instrument: InstrumentRef,
  input: AssetTradeInput,
): Promise<AssetTrade> {
  assertAssetTradeAccountType(account.accountType);

  const accountCurrency = String(account.currency).trim().toUpperCase();
  const instrumentCurrency = String(instrument.currency).trim().toUpperCase();
  if (instrumentCurrency !== accountCurrency) {
    throw badRequest(
      `instrument currency ${instrumentCurrency} must match account currency ${accountCurrency}`,
    );
  }

  if (input.side === "BUY") {
    const cashOut = moneyMajor(
      tradeNotional(input.quantity, input.unitPrice).add(input.commission),
    );
    const cashOutMinor = decimalToMinor(cashOut, "amount");
    if (account.cashBalance < cashOutMinor) {
      throw badRequest("insufficient cash for BUY");
    }

    const trade = await db.assetTrade.create({
      data: {
        accountId: account.id,
        instrumentId: instrument.id,
        side: "BUY",
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        commission: input.commission,
        currency: accountCurrency,
        occurredAt: input.occurredAt,
        settlementDate: input.settlementDate,
        notes: input.notes,
      },
    });

    await postCashTransaction(db, {
      accountId: account.id,
      type: "ASSET_BUY",
      amount: cashOut,
      occurredAt: input.occurredAt,
      description: `BUY ${input.quantity.toString()} ${instrument.symbol}`,
      categoryId: null,
      assetTradeId: trade.id,
    });

    const holding = await resolveHolding(db, account.id, instrument.id);
    await openLot(db, {
      holdingId: holding.id,
      openTradeId: trade.id,
      openedAt: input.occurredAt,
      quantity: input.quantity,
      unitCost: input.unitPrice,
      commissionOpen: input.commission,
    });
    await syncHoldingQuantity(db, holding.id);
    return trade;
  }

  // SELL
  const proceeds = tradeNotional(input.quantity, input.unitPrice);
  if (input.commission.gt(proceeds)) {
    throw badRequest("commission cannot exceed sell proceeds");
  }
  const cashIn = moneyMajor(proceeds.sub(input.commission));

  const trade = await db.assetTrade.create({
    data: {
      accountId: account.id,
      instrumentId: instrument.id,
      side: "SELL",
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      commission: input.commission,
      currency: accountCurrency,
      occurredAt: input.occurredAt,
      settlementDate: input.settlementDate,
      notes: input.notes,
    },
  });

  const holding = await resolveHolding(db, account.id, instrument.id);
  await closeLotsFifo(db, holding.id, input.quantity, trade.id);

  await postCashTransaction(db, {
    accountId: account.id,
    type: "ASSET_SELL",
    amount: cashIn,
    occurredAt: input.occurredAt,
    description: `SELL ${input.quantity.toString()} ${instrument.symbol}`,
    categoryId: null,
    assetTradeId: trade.id,
  });

  await syncHoldingQuantity(db, holding.id);
  return trade;
}

/**
 * Reverse a trade: restore lots / delete opened lot, reverse cash legs, delete trade.
 * BUY that has been partially sold → 400.
 */
export async function reverseAssetTrade(
  db: Db,
  accountId: number,
  tradeId: number,
): Promise<void> {
  const trade = await db.assetTrade.findFirst({
    where: { id: tradeId, accountId },
  });
  if (!trade) throw notFound("Asset trade not found");

  const legs = await db.cashTransaction.findMany({
    where: { assetTradeId: trade.id },
  });

  let holdingId: number | null = null;
  if (trade.side === "BUY") {
    holdingId = await deleteOpenedLotForTrade(db, trade.id);
  } else {
    holdingId = await reverseLotCloses(db, trade.id);
  }

  for (const leg of legs) {
    await reverseCashTransaction(db, accountId, {
      id: leg.id,
      type: parseLedgerTxType(leg.type),
      amount: leg.amount,
    });
  }

  await db.assetTrade.delete({ where: { id: trade.id } });

  if (holdingId != null) {
    await syncHoldingQuantity(db, holdingId);
  }
}

/** Signed minor delta helper for tests / docs. */
export function assetCashSignedMinor(
  side: AssetTradeSide,
  amountMinor: number,
): number {
  return signedMinor(side === "BUY" ? "ASSET_BUY" : "ASSET_SELL", amountMinor);
}
