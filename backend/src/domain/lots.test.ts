import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { realizedPnl, type CloseAllocation } from "./lots";

test("realizedPnl is proceeds minus cost basis and commissions", () => {
  const allocations: CloseAllocation[] = [
    {
      lotId: 1,
      quantity: new Prisma.Decimal(5),
      unitCost: new Prisma.Decimal(100),
      commissionOpenShare: new Prisma.Decimal(1),
    },
    {
      lotId: 2,
      quantity: new Prisma.Decimal(5),
      unitCost: new Prisma.Decimal(110),
      commissionOpenShare: new Prisma.Decimal(0.5),
    },
  ];
  // proceeds 10*120=1200; cost 5*100+1 + 5*110+0.5 = 500+1+550+0.5=1051.5; sell fee 2
  const pnl = realizedPnl(allocations, new Prisma.Decimal(120), new Prisma.Decimal(2));
  assert.equal(pnl.toNumber(), 1200 - 1051.5 - 2);
});
