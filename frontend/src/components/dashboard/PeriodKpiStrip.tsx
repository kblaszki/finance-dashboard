import { Link } from "react-router-dom";
import type { PeriodSummary } from "../../api/statisticsApi";
import { formatMoney, formatPercent } from "../../utils/format";
import { formatPeriodDelta } from "../../utils/periodCompare";

export function PeriodKpiStrip(props: {
  summary: PeriodSummary;
  prevSummary: PeriodSummary | null;
  currency: string;
  /** Primary account for “record expense” deep link when known. */
  firstAccountId?: number | null;
}) {
  const { summary, prevSummary, currency, firstAccountId } = props;
  const savingsRate =
    summary.income > 0 ? (summary.net / summary.income) * 100 : null;
  const prevRate =
    prevSummary && prevSummary.income > 0
      ? (prevSummary.net / prevSummary.income) * 100
      : null;

  const label = summary.label;

  return (
    <div className="dash-period-kpis">
      <div className="dash-period-kpis-head">
        <h2 className="section-title">This month · {label}</h2>
        <div className="dash-period-kpis-actions">
          <Link to="/statistics" className="btn-primary">
            Open cashflow
          </Link>
          {firstAccountId != null ? (
            <Link to={`/accounts/${firstAccountId}`} className="btn-secondary">
              Record expense
            </Link>
          ) : (
            <Link to="/accounts" className="btn-secondary">
              Open accounts
            </Link>
          )}
        </div>
      </div>
      <div className="dash-stat-strip">
        <article className="dash-stat card">
          <div className="dash-stat-head">
            <span>
              Income · {currency}
            </span>
          </div>
          <strong className="dash-stat-value positive">
            {formatMoney(summary.income, currency)}
          </strong>
          <small className="dash-stat-sub">
            {prevSummary
              ? formatPeriodDelta(summary.income, prevSummary.income, currency)
              : "—"}
          </small>
        </article>
        <article className="dash-stat card">
          <div className="dash-stat-head">
            <span>
              Expense · {currency}
            </span>
          </div>
          <strong className="dash-stat-value negative">
            {formatMoney(summary.expense, currency)}
          </strong>
          <small className="dash-stat-sub">
            {prevSummary
              ? formatPeriodDelta(
                  summary.expense,
                  prevSummary.expense,
                  currency,
                )
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
            <span>Monthly net · {currency}</span>
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
              ? formatPeriodDelta(summary.net, prevSummary.net, currency)
              : "—"}
          </small>
        </article>
      </div>
      <p className="dash-period-fx-note">
        All accounts converted to {currency} via NBP mid rates on each
        transaction date.
      </p>
    </div>
  );
}
