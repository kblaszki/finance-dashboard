import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "../ui/ChartCard";
import { formatMoney, formatPercent } from "../../utils/format";

export type CashflowChartPoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number | null;
};

export function CashflowHistoryChart(props: {
  series: CashflowChartPoint[];
  currency: string;
  historyMonths: number;
  periodLabel: string;
}) {
  const { series, currency, historyMonths, periodLabel } = props;

  return (
    <ChartCard
      title={`Cashflow history (${currency})`}
      subtitle={`${historyMonths} months ending ${periodLabel}, with savings rate on the right axis.`}
    >
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={series}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
          />
          <YAxis
            yAxisId="money"
            tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
            width={70}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
            width={48}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === "Savings %") {
                return [
                  typeof value === "number"
                    ? formatPercent(value, { decimals: 1 })
                    : "—",
                  "Savings %",
                ];
              }
              return [
                typeof value === "number"
                  ? formatMoney(value, currency)
                  : String(value ?? ""),
                String(name),
              ];
            }}
          />
          <Legend />
          <Bar
            yAxisId="money"
            dataKey="income"
            name="Income"
            fill="var(--chart-1)"
            maxBarSize={24}
            radius={[3, 3, 0, 0]}
          />
          <Bar
            yAxisId="money"
            dataKey="expense"
            name="Expense"
            fill="var(--chart-3)"
            maxBarSize={24}
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="money"
            type="monotone"
            dataKey="net"
            name="Net"
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="savingsRate"
            name="Savings %"
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="muted">
        Legend: Income, Expense, and Net use the left axis. Savings % uses the
        right axis.
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <caption className="muted">Cashflow history values</caption>
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Income</th>
              <th className="num">Expense</th>
              <th className="num">Net</th>
              <th className="num">Savings %</th>
            </tr>
          </thead>
          <tbody>
            {series.map((row) => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td className="num">{formatMoney(row.income, currency)}</td>
                <td className="num">{formatMoney(row.expense, currency)}</td>
                <td className="num">{formatMoney(row.net, currency)}</td>
                <td className="num">
                  {row.savingsRate == null
                    ? "—"
                    : formatPercent(row.savingsRate, { decimals: 1 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
