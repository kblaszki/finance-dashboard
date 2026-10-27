import type { PeriodSummary } from "../../api/statisticsApi";
import { formatMoney, formatPercent } from "../../utils/format";
import { formatPeriodDelta } from "../../utils/periodCompare";

export function PeriodKpiStrip(props: {
  summary: PeriodSummary;
  prevSummary: PeriodSummary | null;
  currency: string;
}) {
  const { summary, prevSummary, currency } = props;
  const savingsRate =
    summary.income > 0 ? (summary.net / summary.income) * 100 : null;
  const prevRate =
    prevSummary && prevSummary.income > 0
      ? (prevSummary.net / prevSummary.income) * 100
      : null;

  const label = summary.label;

  return (
    <div className="dash-stat-strip">
      <article className="dash-stat card">
        <div className="dash-stat-head">
          <span>Income · {label}</span>
        </div>
        <strong className="dash-stat-value positive">
          {formatMoney(summary.income, currency)}
        </strong>
        <small className="dash-stat-sub">
          {prevSummary
            ? formatPeriodDelta(summary.income, prevSummary.income)
            : "—"}
        </small>
      </article>
      <article className="dash-stat card">
        <div className="dash-stat-head">
          <span>Expense · {label}</span>
        </div>
        <strong className="dash-stat-value negative">
          {formatMoney(summary.expense, currency)}
        </strong>
        <small className="dash-stat-sub">
          {prevSummary
            ? formatPeriodDelta(summary.expense, prevSummary.expense)
            : "—"}
        </small>
      </article>
      <article className="dash-stat card">
        <div className="dash-stat-head">
          <span>Savings ratio</span>
        </div>
        <strong className="dash-stat-value">
          {formatPercent(savingsRate, { decimals: 1 })}
        </strong>
        <small
          className={
            savingsRate != null && prevRate != null && savingsRate >= prevRate
              ? "dash-stat-sub positive"
              : "dash-stat-sub"
          }
        >
          {savingsRate != null && prevRate != null
            ? `${formatPercent(savingsRate - prevRate, {
                decimals: 1,
                signed: true,
              })} pp vs prev`
            : "— vs prev"}
        </small>
      </article>
      <article className="dash-stat card">
        <div className="dash-stat-head">
          <span>Monthly net</span>
        </div>
        <strong
          className={
            summary.net >= 0
              ? "dash-stat-value positive"
              : "dash-stat-value negative"
          }
        >
          {formatMoney(summary.net, currency)}
        </strong>
        <small className="dash-stat-sub">
          {prevSummary
            ? formatPeriodDelta(summary.net, prevSummary.net)
            : "—"}
        </small>
      </article>
    </div>
  );
}
