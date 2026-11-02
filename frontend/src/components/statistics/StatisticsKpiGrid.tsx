import type { PeriodSummary } from "../../api/statisticsApi";
import { KpiCard } from "../ui/KpiCard";
import { formatMoney, formatPercent } from "../../utils/format";
import { formatPeriodDelta } from "../../utils/periodCompare";

export function StatisticsKpiGrid(props: {
  summary: PeriodSummary;
  prevSummary: PeriodSummary | null | undefined;
  periodLabel: string;
  currency: string;
}) {
  const { summary, prevSummary, periodLabel, currency } = props;
  const savingsRate =
    summary.income > 0 ? (summary.net / summary.income) * 100 : null;
  const prevRate =
    prevSummary && prevSummary.income > 0
      ? (prevSummary.net / prevSummary.income) * 100
      : null;

  return (
    <div className="stats-kpi-block">
      <div className="kpi-grid">
        <KpiCard
          label={`Income · ${periodLabel}`}
          value={formatMoney(summary.income, currency)}
          tone="positive"
          sub={
            prevSummary
              ? formatPeriodDelta(
                  summary.income,
                  prevSummary.income,
                  currency,
                )
              : undefined
          }
        />
        <KpiCard
          label={`Expense · ${periodLabel}`}
          value={formatMoney(summary.expense, currency)}
          tone="negative"
          sub={
            prevSummary
              ? formatPeriodDelta(
                  summary.expense,
                  prevSummary.expense,
                  currency,
                )
              : undefined
          }
        />
        <KpiCard
          label={`Net · ${periodLabel}`}
          value={formatMoney(summary.net, currency)}
          tone={summary.net >= 0 ? "positive" : "negative"}
          sub={
            prevSummary
              ? formatPeriodDelta(summary.net, prevSummary.net, currency)
              : undefined
          }
        />
        <KpiCard
          label="Savings ratio"
          value={formatPercent(savingsRate, { decimals: 1 })}
          tone={
            savingsRate == null
              ? undefined
              : savingsRate >= 0
                ? "positive"
                : "negative"
          }
          sub={
            savingsRate != null && prevRate != null
              ? `${formatPercent(savingsRate - prevRate, {
                  decimals: 1,
                  signed: true,
                })} pp vs prev`
              : undefined
          }
        />
      </div>
      <p className="muted stats-fx-note">
        All accounts converted to {currency} via NBP mid rates on each
        transaction date. Transfers this period:{" "}
        <strong>{formatMoney(summary.transfers, currency)}</strong>
        {prevSummary
          ? ` (${formatPeriodDelta(
              summary.transfers,
              prevSummary.transfers,
              currency,
            )})`
          : ""}
        ; transfers do not change income, expense, or net.
      </p>
    </div>
  );
}
