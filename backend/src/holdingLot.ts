export type LotSide = "BUY" | "SELL";

export function isValidLotSide(side: string): side is LotSide {
  return side === "BUY" || side === "SELL";
}

export function computeQuantityAfter(previousQty: number, side: LotSide, quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive number");
  }
  const next = side === "BUY" ? previousQty + quantity : previousQty - quantity;
  if (next < 0) {
    throw new Error("Cannot sell more than current position");
  }
  return next;
}

export type LotPriceInput = {
  quantity: number;
  totalPrice?: number | null;
  pricePerUnit?: number | null;
};

export type ResolvedLotPrice = {
  totalPrice: number;
  pricePerUnit: number;
};

export function resolveLotPrice(input: LotPriceInput): ResolvedLotPrice {
  const { quantity } = input;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be positive");
  }
  const total = input.totalPrice != null ? Number(input.totalPrice) : null;
  const unit = input.pricePerUnit != null ? Number(input.pricePerUnit) : null;

  if (total != null && unit != null) {
    const implied = total / quantity;
    if (Math.abs(implied - unit) > 0.0001) {
      throw new Error("totalPrice and pricePerUnit are inconsistent");
    }
    return { totalPrice: total, pricePerUnit: unit };
  }
  if (unit != null) {
    return { totalPrice: unit * quantity, pricePerUnit: unit };
  }
  if (total != null) {
    return { totalPrice: total, pricePerUnit: total / quantity };
  }
  throw new Error("Provide totalPrice or pricePerUnit");
}

export type LotChainRow = {
  id: number;
  side: string;
  quantity: number;
  tradeDate?: Date;
};

export function recomputeQuantityAfterChain(lots: LotChainRow[]): Map<number, number> {
  const sorted = [...lots].sort((a, b) => {
    const byTradeDate = (a.tradeDate?.getTime() ?? 0) - (b.tradeDate?.getTime() ?? 0);
    if (byTradeDate !== 0) return byTradeDate;
    return a.id - b.id;
  });
  const result = new Map<number, number>();
  let running = 0;
  for (const lot of sorted) {
    if (!isValidLotSide(lot.side)) {
      throw new Error(`Invalid lot side: ${lot.side}`);
    }
    running = computeQuantityAfter(running, lot.side, Number(lot.quantity));
    result.set(lot.id, running);
  }
  return result;
}

export type ValuationPoint = { valuationDate: Date; price: number };

export function priceAsOf(valuations: ValuationPoint[], asOf: Date): number | null {
  const t = asOf.getTime();
  let best: ValuationPoint | null = null;
  for (const v of valuations) {
    if (v.valuationDate.getTime() <= t && (!best || v.valuationDate.getTime() > best.valuationDate.getTime())) {
      best = v;
    }
  }
  return best?.price ?? null;
}
