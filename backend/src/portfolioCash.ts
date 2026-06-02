export type CashTransfer = { amount: number };
export type TradeEntry = { side: string; quantity: number; tradePrice: number };

export function computePortfolioCashBalance(
  transfers: CashTransfer[],
  trades: TradeEntry[],
): number {
  let balance = transfers.reduce((acc, t) => acc + t.amount, 0);
  for (const t of trades) {
    const value = t.quantity * t.tradePrice;
    balance += t.side === "BUY" ? -value : value;
  }
  return balance;
}

