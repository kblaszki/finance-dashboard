import { Prisma } from "@prisma/client";

export const BELKA_RATE = new Prisma.Decimal("0.19");

export const BOND_RATE_KINDS = [
  "FIXED",
  "FLOATING",
  "INFLATION_LINKED",
] as const;
export type BondRateKind = (typeof BOND_RATE_KINDS)[number];

export const BOND_COUPON_FREQUENCIES = [
  "ANNUAL",
  "SEMI_ANNUAL",
  "QUARTERLY",
  "AT_MATURITY",
] as const;
export type BondCouponFrequency = (typeof BOND_COUPON_FREQUENCIES)[number];

export type BondValuationInput = {
  quantity: Prisma.Decimal | number | string;
  unitNominal: Prisma.Decimal | number | string;
  unitPurchasePrice: Prisma.Decimal | number | string;
  currentAnnualRatePct: Prisma.Decimal | number | string;
  earlyExitFeePerUnit: Prisma.Decimal | number | string;
  periodStart: Date;
  maturityDate: Date;
  asOf: Date;
};

export type BondValuation = {
  nominalValue: number;
  accruedInterest: number;
  grossValue: number;
  earlyExitFee: number;
  costBasis: number;
  belkaEstimate: number;
  liquidationNet: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC calendar-day difference (asOf − from), floored; never negative. */
export function utcDayDiff(from: Date, asOf: Date): number {
  const a = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const b = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate(),
  );
  return Math.max(0, Math.floor((b - a) / MS_PER_DAY));
}

function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Accrue simple interest actual/365 on nominal from periodStart to asOf,
 * capped at maturityDate. Rate is annual percent (e.g. 6.5 → 6.5%).
 */
export function valueBondPosition(input: BondValuationInput): BondValuation {
  const quantity = new Prisma.Decimal(input.quantity);
  const unitNominal = new Prisma.Decimal(input.unitNominal);
  const unitPurchasePrice = new Prisma.Decimal(input.unitPurchasePrice);
  const ratePct = new Prisma.Decimal(input.currentAnnualRatePct);
  const feePerUnit = new Prisma.Decimal(input.earlyExitFeePerUnit);

  const nominalValue = round2(quantity.mul(unitNominal));
  const costBasis = round2(quantity.mul(unitPurchasePrice));
  const earlyExitFee = round2(quantity.mul(feePerUnit));

  const endCap =
    input.asOf.getTime() > input.maturityDate.getTime()
      ? input.maturityDate
      : input.asOf;
  const days = utcDayDiff(input.periodStart, endCap);
  const accruedInterest =
    days <= 0 || ratePct.lte(0) || nominalValue.lte(0)
      ? new Prisma.Decimal(0)
      : round2(
          nominalValue
            .mul(ratePct)
            .div(100)
            .mul(days)
            .div(365),
        );

  const grossValue = round2(nominalValue.add(accruedInterest));
  const taxable = Prisma.Decimal.max(
    0,
    grossValue.sub(earlyExitFee).sub(costBasis),
  );
  const belkaEstimate = round2(taxable.mul(BELKA_RATE));
  const liquidationNet = round2(
    grossValue.sub(earlyExitFee).sub(belkaEstimate),
  );

  return {
    nominalValue: nominalValue.toNumber(),
    accruedInterest: accruedInterest.toNumber(),
    grossValue: grossValue.toNumber(),
    earlyExitFee: earlyExitFee.toNumber(),
    costBasis: costBasis.toNumber(),
    belkaEstimate: belkaEstimate.toNumber(),
    liquidationNet: liquidationNet.toNumber(),
  };
}

export function sumBondGross(
  valuations: Array<{ grossValue: number }>,
): number {
  let total = new Prisma.Decimal(0);
  for (const v of valuations) {
    total = total.add(v.grossValue);
  }
  return round2(total).toNumber();
}
