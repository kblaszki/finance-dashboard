export type FifoLotInput = {
  id: number;
  side: string;
  quantity: number;
  pricePerUnit: number;
  currency: string;
  tradeDate: Date;
  totalPrice?: number;
  commission?: number;
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

  const buyQueues = new Map<string, Array<{ quantity: number; pricePerUnit: number }>>();

  function buyQueueFor(currency: string): Array<{ quantity: number; pricePerUnit: number }> {
    let queue = buyQueues.get(currency);
    if (!queue) {
      queue = [];
      buyQueues.set(currency, queue);
    }
    return queue;
  }

  const events: RealizedGainEvent[] = [];

  function lotGross(lot: FifoLotInput): number {
    return lot.totalPrice ?? lot.quantity * lot.pricePerUnit;
  }

  for (const lot of sorted) {
    if (lot.side === "BUY") {
      const fee = lot.commission ?? 0;
      const totalCost = lotGross(lot) + fee;
      buyQueueFor(lot.currency).push({
        quantity: lot.quantity,
        pricePerUnit: totalCost / lot.quantity,
      });
      continue;
    }
    if (lot.side !== "SELL") continue;

    const buyQueue = buyQueueFor(lot.currency);
    let remaining = lot.quantity;
    let cost = 0;
    while (remaining > 0 && buyQueue.length > 0) {
      const head = buyQueue[0]!;
      const take = Math.min(remaining, head.quantity);
      cost += take * head.pricePerUnit;
      head.quantity -= take;
      remaining -= take;
      if (head.quantity <= 0) buyQueue.shift();
    }
    if (remaining > 0) {
      throw new Error(
        `Cannot sell more than current position in ${lot.currency} (insufficient buy lots or currency mismatch)`,
      );
    }

    const proceeds = lotGross(lot) - (lot.commission ?? 0);
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
