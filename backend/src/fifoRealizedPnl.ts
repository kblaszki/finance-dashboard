export type FifoLotInput = {
  id: number;
  side: string;
  quantity: number;
  pricePerUnit: number;
  currency: string;
  tradeDate: Date;
};

export type RealizedGainEvent = {
  lotId: number;
  tradeDate: Date;
  quantity: number;
  proceeds: number;
  cost: number;
  gainLoss: number;
  currency: string;
};

export function computeFifoRealizedEvents(lots: FifoLotInput[]): RealizedGainEvent[] {
  const sorted = [...lots].sort((a, b) => {
    const byDate = a.tradeDate.getTime() - b.tradeDate.getTime();
    if (byDate !== 0) return byDate;
    return a.id - b.id;
  });

  const buyQueue: Array<{ quantity: number; pricePerUnit: number }> = [];
  const events: RealizedGainEvent[] = [];

  for (const lot of sorted) {
    if (lot.side === "BUY") {
      buyQueue.push({ quantity: lot.quantity, pricePerUnit: lot.pricePerUnit });
      continue;
    }
    if (lot.side !== "SELL") continue;

    let remaining = lot.quantity;
    let cost = 0;
    while (remaining > 0 && buyQueue.length > 0) {
      const head = buyQueue[0];
      const take = Math.min(remaining, head.quantity);
      cost += take * head.pricePerUnit;
      head.quantity -= take;
      remaining -= take;
      if (head.quantity <= 0) buyQueue.shift();
    }
    if (remaining > 0) {
      throw new Error("Cannot sell more than current position");
    }

    const proceeds = lot.quantity * lot.pricePerUnit;
    events.push({
      lotId: lot.id,
      tradeDate: lot.tradeDate,
      quantity: lot.quantity,
      proceeds,
      cost,
      gainLoss: proceeds - cost,
      currency: lot.currency,
    });
  }

  return events;
}

export function sumGainLoss(events: RealizedGainEvent[]): number {
  return events.reduce((sum, e) => sum + e.gainLoss, 0);
}
