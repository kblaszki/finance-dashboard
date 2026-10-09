import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AccountBalanceHistory } from "../../api/accountsApi";
import { formatMoney } from "../../utils/format";
import { ChartCard } from "../ui/ChartCard";
import { StatusBlock } from "../ui/StatusBlock";

const HISTORY_MONTH_OPTIONS = [6, 12, 24] as const;

export function AccountBalanceChart(props: {
  history: AccountBalanceHistory | null;
  loading: boolean;
  error: string | null;
  currency: string;
  months: number;
  onMonthsChange: (months: number) => void;
}) {
  const { history, loading, error, currency, months, onMonthsChange } = props;
  const series = history?.series ?? [];

  return (
    <ChartCard
      title="Balance history"
      subtitle={`End-of-month cash balance · ${months} months · ${currency}`}
      actions={
        <label>
          Range{" "}
          <select
            value={months}
            onChange={(e) => onMonthsChange(Number(e.target.value))}
            aria-label="Balance history range"
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
        loadingMessage="Loading balance history…"
        emptyMessage="No balance history yet."
      />
      {!error && series.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
              width={70}
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
            />
            <Area
              type="monotone"
              dataKey="balance"
              name="Balance"
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
