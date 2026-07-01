import type { EodBar } from "../../src/marketData";
import { closeOnDate, utcDateOnly } from "./marketHistory";

export type PlannedLot = {
  side: "BUY" | "SELL";
  quantity: number;
  pricePerUnit: number;
  tradeDate: Date;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(12, 0, 0, 0);
  return utcDateOnly(d);
}

/** Deterministic buy/sell sequence over `daysSpan`; prices from EOD bars; never oversells. */
export function planBrokerageTrades(
  bars: EodBar[],
  daysSpan: number,
  tradeCount: number,
  instrumentIndex: number,
  opts?: { investHeavy?: boolean },
): PlannedLot[] {
  const investHeavy = opts?.investHeavy ?? false;
  if (tradeCount < 10) {
    throw new Error("tradeCount must be at least 10");
  }
  if (daysSpan < 365) {
    throw new Error("daysSpan must be at least 365");
  }

  const lots: PlannedLot[] = [];
  let qty = 0;
  const minDay = 5;
  const step = (daysSpan - minDay) / (tradeCount - 1);

  for (let i = 0; i < tradeCount; i++) {
    const dayOffset = Math.round(daysSpan - i * step);
    const tradeDate = daysAgo(dayOffset);
    const close = closeOnDate(bars, tradeDate) ?? bars[0]?.close ?? null;
    if (close == null) continue;

    const pricePerUnit = round2(close);
    const sellEvery = investHeavy ? 7 : 4;
    const sellStart = investHeavy ? 6 : 3;
    const isSell = i >= sellStart && i % sellEvery === sellEvery - 1 && qty > 0;

    if (isSell) {
      const sellPct = investHeavy ? 0.12 + (i % 3) * 0.03 : 0.25 + (i % 3) * 0.1;
      const sellQty = Math.min(qty, Math.max(1, Math.floor(qty * sellPct)));
      lots.push({
        side: "SELL",
        quantity: sellQty,
        pricePerUnit: round2(pricePerUnit * (1.005 + (i % 5) * 0.002)),
        tradeDate,
      });
      qty -= sellQty;
    } else {
      const buyUnit = pricePerUnit > 200 ? 1 : pricePerUnit > 80 ? 2 : 5;
      const buyBoost = investHeavy ? 2 : 0;
      const buyQty = buyUnit + (instrumentIndex % 2) + (i % 2) + buyBoost;
      lots.push({ side: "BUY", quantity: buyQty, pricePerUnit, tradeDate });
      qty += buyQty;
    }
  }

  return lots;
}
