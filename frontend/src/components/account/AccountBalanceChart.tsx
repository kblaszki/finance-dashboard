import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
      subtitle={`End-of-month cash, holdings MTM, and equity · ${months} months · ${currency}`}
      actions={
        <label>
          Range{" "}
          <select
            className="field-control field-control--compact"
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
          <LineChart data={series}>
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
              formatter={(value, name) => [
                typeof value === "number"
                  ? formatMoney(value, currency)
                  : String(value ?? ""),
                String(name),
              ]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="cashBalance"
              name="Cash"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="holdingsValue"
              name="Holdings"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="totalEquity"
              name="Equity"
              stroke="var(--chart-3)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
