import type { PeriodSummary } from "../../api/statisticsApi";
import { KpiCard } from "../ui/KpiCard";
import { formatMoney } from "../../utils/format";
import { formatPeriodDelta } from "../../utils/periodCompare";

export function StatisticsKpiGrid(props: {
  summary: PeriodSummary;
  prevSummary: PeriodSummary | null | undefined;
  periodLabel: string;
  currency: string;
}) {
  const { summary, prevSummary, periodLabel, currency } = props;

  return (
    <div className="kpi-grid">
      <KpiCard
        label={`Income · ${periodLabel}`}
        value={formatMoney(summary.income, currency)}
        tone="positive"
        sub={
          prevSummary
            ? formatPeriodDelta(summary.income, prevSummary.income)
            : undefined
        }
      />
      <KpiCard
        label={`Expense · ${periodLabel}`}
        value={formatMoney(summary.expense, currency)}
        tone="negative"
        sub={
          prevSummary
            ? formatPeriodDelta(summary.expense, prevSummary.expense)
            : undefined
        }
      />
      <KpiCard
        label={`Net · ${periodLabel}`}
        value={formatMoney(summary.net, currency)}
        tone={summary.net >= 0 ? "positive" : "negative"}
        sub={
          prevSummary
            ? formatPeriodDelta(summary.net, prevSummary.net)
            : undefined
        }
      />
      <KpiCard
        label={`Transfers · ${periodLabel}`}
        value={formatMoney(summary.transfers, currency)}
        sub={
          prevSummary
            ? formatPeriodDelta(summary.transfers, prevSummary.transfers)
            : undefined
        }
      />
    </div>
  );
}
