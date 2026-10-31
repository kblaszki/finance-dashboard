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

export function InstrumentHistoryChart(props: {
  history: InstrumentHistory | null;
  loading: boolean;
  error: string | null;
  months: number;
  onMonthsChange: (months: number) => void;
}) {
  const { history, loading, error, months, onMonthsChange } = props;
  const series = history?.series ?? [];
  const currency = history?.currency ?? "USD";

  return (
    <ChartCard
      title="Price history"
      subtitle={`Daily close · ${months} months · ${currency}`}
      actions={
        <label>
          Range{" "}
          <select
            className="field-control field-control--compact"
            value={months}
            onChange={(e) => onMonthsChange(Number(e.target.value))}
            aria-label="Price history range"
          >
            {HISTORY_MONTH_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} months
              </option>
            ))}
          </select>
        </label>
      }
    >
      <StatusBlock
        loading={loading && series.length === 0}
        error={error}
        empty={!loading && !error && series.length === 0}
        loadingMessage="Loading price history…"
        emptyMessage="No history yet. Run market:sync-history or wait for soft backfill on refresh."
      />
      {history?.backfillMessage && series.length === 0 && !error && (
        <p className="muted" role="status">
          {history.backfillMessage}
        </p>
      )}
      {!error && series.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
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
      )}
    </ChartCard>
  );
}
