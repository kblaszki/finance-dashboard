import type { StatsPeriod } from "../../api/statisticsApi";
import {
  anchorForQuarter,
  anchorForYear,
  quarterOf,
  YEAR_OPTIONS,
  yearOf,
} from "../../utils/statisticsPeriod";

const HISTORY_MONTH_OPTIONS = [6, 12, 24] as const;
const PERIOD_OPTIONS: { value: StatsPeriod; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

export function StatisticsPeriodFilter(props: {
  period: StatsPeriod;
  month: string;
  historyMonths: number;
  periodLabel: string;
  currency: string | null;
  onPeriodChange: (period: StatsPeriod) => void;
  onMonthChange: (month: string) => void;
  onHistoryMonthsChange: (months: number) => void;
}) {
  const {
    period,
    month,
    historyMonths,
    periodLabel,
    currency,
    onPeriodChange,
    onMonthChange,
    onHistoryMonthsChange,
  } = props;

  return (
    <section className="card form-section-gap period-filter">
      <div
        className="stats-segmented"
        role="group"
        aria-label="Analysis period"
      >
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={
              period === opt.value
                ? "stats-segmented__btn stats-segmented__btn--active"
                : "stats-segmented__btn"
            }
            aria-pressed={period === opt.value}
            onClick={() => onPeriodChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="period-filter-row">
        {period === "month" && (
          <label>
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => onMonthChange(e.target.value)}
              required
            />
          </label>
        )}
        {period === "quarter" && (
          <>
            <label>
              Year
              <select
                value={yearOf(month)}
                onChange={(e) =>
                  onMonthChange(
                    anchorForQuarter(Number(e.target.value), quarterOf(month)),
                  )
                }
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quarter
              <select
                value={quarterOf(month)}
                onChange={(e) =>
                  onMonthChange(
                    anchorForQuarter(yearOf(month), Number(e.target.value)),
                  )
                }
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    Q{q}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {period === "year" && (
          <label>
            Year
            <select
              value={yearOf(month)}
              onChange={(e) =>
                onMonthChange(anchorForYear(Number(e.target.value)))
              }
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          History range
          <select
            value={historyMonths}
            onChange={(e) => onHistoryMonthsChange(Number(e.target.value))}
          >
            {HISTORY_MONTH_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} months
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted period-filter-summary">
        Showing <strong>{periodLabel}</strong>
        {currency ? ` · ${currency}` : ""}. Currency is set in the top bar.
        Transfers are listed separately and do not change income, expense, or
        net. Tag totals count the full amount on each attached tag.
      </p>
    </section>
  );
}
