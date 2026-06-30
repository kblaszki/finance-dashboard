import type { PrismaClient } from "@prisma/client";
import { convertAmount } from "./fx";
import { computeFifoRealizedEvents } from "./fifoRealizedPnl";
import { toNumber } from "./accountValuation";
import {
  accountIncludedInPit38,
  fetchWithdrawalsForTaxYear,
} from "./taxWrapper";
import { applyLossCarryforward, listTaxLossCarryforwards } from "./taxLossCarryforward";

export type PreSellSimulationInput = {
  holdingId: number;
  quantity: number;
  salePricePerUnit?: number;
  saleDate?: Date;
};

export type PreSellSimulationResult = {
  holdingId: number;
  symbol: string;
  accountId: number;
  accountName: string;
  quantity: number;
  proceeds: number;
  cost: number;
  gainLoss: number;
  currency: string;
  taxRegime: "pit38" | "crypto_pit" | "excluded_wrapper";
  pit38TaxableAfterLosses: number | null;
  message: string;
};

function isCryptoHolding(accountType: string, instrumentType: string): boolean {
  return accountType === "CRYPTO" || instrumentType.toUpperCase() === "CRYPTO";
}

export async function simulatePreSellTax(
  prisma: PrismaClient,
  userId: number,
  input: PreSellSimulationInput,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<PreSellSimulationResult> {
  const holding = await prisma.holding.findFirst({
    where: { id: input.holdingId, account: { userId } },
    include: {
      account: true,
      instrument: true,
      lots: { orderBy: [{ tradeDate: "asc" }, { id: "asc" }] },
    },
  });
  if (!holding) {
    throw new Error("Holding not found");
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("quantity must be positive");
  }

  const account = holding.account;
  const taxYear = (input.saleDate ?? new Date()).getUTCFullYear();
  const crypto = isCryptoHolding(account.accountType, holding.instrument.instrumentType);

  if (!crypto && account.accountType === "BROKERAGE") {
    const withdrawals = await fetchWithdrawalsForTaxYear(prisma, userId, taxYear);
    const withdrawalsForAccount = withdrawals.get(account.id) ?? [];
    if (!accountIncludedInPit38(account.taxWrapperType, withdrawalsForAccount)) {
      return {
        holdingId: holding.id,
        symbol: holding.instrument.symbol,
        accountId: account.id,
        accountName: account.name,
        quantity: input.quantity,
        proceeds: 0,
        cost: 0,
        gainLoss: 0,
        currency: displayCurrency,
        taxRegime: "excluded_wrapper",
        pit38TaxableAfterLosses: null,
        message: `Account excluded from PIT-38 (${account.taxWrapperType}) unless qualifying withdrawal exists (FR-039).`,
      };
    }
  }

  const fifoLots = holding.lots.map((lot) => {
    const mapped = {
      id: lot.id,
      side: lot.side,
      quantity: toNumber(lot.quantity),
      pricePerUnit: toNumber(lot.pricePerUnit ?? 0),
      commission: toNumber(lot.commission ?? 0),
      currency: lot.currency,
      tradeDate: lot.tradeDate,
    };
    if (lot.totalPrice != null) {
      return { ...mapped, totalPrice: toNumber(lot.totalPrice) };
    }
    return mapped;
  });

  const salePrice =
    input.salePricePerUnit ??
    toNumber(holding.lots[holding.lots.length - 1]?.pricePerUnit ?? 0) ??
    0;
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error("salePricePerUnit required when no price history");
  }

  const currency = holding.lots[0]?.currency ?? account.currency;
  const hypotheticalLots = [
    ...fifoLots,
    {
      id: -1,
      side: "SELL",
      quantity: input.quantity,
      pricePerUnit: salePrice,
      commission: 0,
      currency,
      tradeDate: input.saleDate ?? new Date(),
      totalPrice: salePrice * input.quantity,
    },
  ];

  const events = computeFifoRealizedEvents(hypotheticalLots);
  const lastEvent = events[events.length - 1];
  if (!lastEvent) {
    throw new Error("Cannot simulate sell — insufficient position");
  }

  const proceeds = convertAmount(lastEvent.proceeds, lastEvent.currency, displayCurrency, plnPerUnit);
  const cost = convertAmount(lastEvent.cost, lastEvent.currency, displayCurrency, plnPerUnit);
  const gainLoss = convertAmount(lastEvent.gainLoss, lastEvent.currency, displayCurrency, plnPerUnit);

  let pit38TaxableAfterLosses: number | null = null;
  let taxRegime: PreSellSimulationResult["taxRegime"] = crypto ? "crypto_pit" : "pit38";
  if (!crypto) {
    const lossRows = await listTaxLossCarryforwards(prisma, userId);
    const { taxableGain } = applyLossCarryforward(
      gainLoss,
      lossRows.map((r) => ({
        taxYear: r.taxYear,
        lossAmount: toNumber(r.lossAmount),
        usedAmount: toNumber(r.usedAmount),
      })),
    );
    pit38TaxableAfterLosses = Math.max(0, taxableGain);
  }

  return {
    holdingId: holding.id,
    symbol: holding.instrument.symbol,
    accountId: account.id,
    accountName: account.name,
    quantity: input.quantity,
    proceeds,
    cost,
    gainLoss,
    currency: displayCurrency,
    taxRegime,
    pit38TaxableAfterLosses,
    message: crypto
      ? "Estimated crypto disposal gain (PIT scale, FR-043)."
      : "Estimated PIT-38 FIFO gain before 19% Belka on securities (FR-050).",
  };
}
