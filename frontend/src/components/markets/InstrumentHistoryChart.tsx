import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InstrumentHistory } from "../../api/instrumentsApi";
import { formatMoney } from "../../utils/format";
import { ChartCard } from "../ui/ChartCard";
import { StatusBlock } from "../ui/StatusBlock";

const HISTORY_MONTH_OPTIONS = [3, 6, 12] as const;

export type HistoryViewMode = "months" | "year";

export function InstrumentHistoryChart(props: {
  history: InstrumentHistory | null;
  loading: boolean;
  error: string | null;
  mode: HistoryViewMode;
  months: number;
  year: number;
  onModeChange: (mode: HistoryViewMode) => void;
  onMonthsChange: (months: number) => void;
  onYearChange: (year: number) => void;
}) {
  const {
    history,
    loading,
    error,
    mode,
    months,
    year,
    onModeChange,
    onMonthsChange,
    onYearChange,
  } = props;
  const series = history?.series ?? [];
  const currency = history?.currency ?? "USD";
  const oldestYear = history?.oldestYear ?? year;
  const newestYear = history?.newestYear ?? year;
  const canPrevYear = year > oldestYear;
  const canNextYear = year < newestYear;

  const subtitle =
    mode === "year"
      ? `Daily close · ${year} · ${currency}`
      : `Daily close · ${months} months · ${currency}`;

  return (
    <ChartCard
      title="Price history"
      subtitle={subtitle}
      actions={
        <div className="form-actions-row">
          <label>
            Range{" "}
            <select
              className="field-control field-control--compact"
              value={mode === "year" ? "year" : String(months)}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "year") {
                  onModeChange("year");
                  return;
                }
                onModeChange("months");
                onMonthsChange(Number(value));
              }}
              aria-label="Price history range"
            >
              {HISTORY_MONTH_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} months
                </option>
              ))}
              <option value="year">Calendar year</option>
            </select>
          </label>
          {mode === "year" && (
            <>
              <button
                type="button"
                className="btn-secondary"
                aria-label="Previous year"
                disabled={!canPrevYear}
                onClick={() => onYearChange(year - 1)}
              >
                ‹
              </button>
              <span className="muted" aria-live="polite">
                {year}
              </span>
              <button
                type="button"
                className="btn-secondary"
                aria-label="Next year"
                disabled={!canNextYear}
                onClick={() => onYearChange(year + 1)}
              >
                ›
              </button>
            </>
          )}
        </div>
      }
    >
      <StatusBlock
        loading={loading && series.length === 0}
        error={error}
        empty={!loading && !error && series.length === 0}
        loadingMessage="Loading price history…"
        emptyMessage="No history yet. Run market:sync-history-yahoo --range=10y or wait for soft backfill on refresh."
      />
      {history?.backfillMessage && series.length === 0 && !error && (
        <p className="muted" role="status">
          {history.backfillMessage}
        </p>
      )}
      {!error && series.length > 0 && (
        <div className="chart-plot chart-plot--md">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="asOf"
              tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
              width={70}
              domain={["auto", "auto"]}
              tickFormatter={(value) =>
                typeof value === "number" ? formatMoney(value, currency) : ""
              }
            />
            <Tooltip
              formatter={(value) =>
                typeof value === "number"
                  ? formatMoney(value, currency)
                  : String(value ?? "")
              }
              labelFormatter={(label) => String(label)}
            />
            <Area
              type="monotone"
              dataKey="close"
              name="Close"
              stroke="var(--chart-1)"
              fill="var(--chart-1)"
              fillOpacity={0.18}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
