import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartCard } from "../ui/ChartCard";
import { formatMoney } from "../../utils/format";
import type { RollupRow } from "../../utils/statisticsRollup";
import { CHART_COLORS } from "./chartColors";

export function BreakdownPanel(props: {
  title: string;
  rows: RollupRow[];
  currency: string;
  tone: "positive" | "negative" | "neutral";
  emptyLabel: string;
  subtitle: string;
  byLabel?: string;
}) {
  const {
    title,
    rows,
    currency,
    tone,
    emptyLabel,
    subtitle,
    byLabel = "category",
  } = props;
  const toneClass = tone === "neutral" ? "" : `stat-row-value ${tone}`;
  return (
    <ChartCard title={`${title} by ${byLabel}`} subtitle={subtitle}>
      {rows.length === 0 ? (
        <p className="empty-state">{emptyLabel}</p>
      ) : (
        <div className="donut-layout">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={rows}
                dataKey="total"
                nameKey="name"
                innerRadius="62%"
                outerRadius="90%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {rows.map((row, index) => (
                  <Cell
                    key={row.key}
                    fill={CHART_COLORS[index % CHART_COLORS.length]!}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  typeof value === "number"
                    ? formatMoney(value, currency)
                    : String(value ?? "")
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <ul className="legend-list">
            {rows.map((row, index) => (
              <li key={row.key} className="legend-row">
                <span className="legend-name">
                  <span
                    className="legend-dot"
                    style={{
                      background: CHART_COLORS[index % CHART_COLORS.length],
                    }}
                    aria-hidden
                  />
                  {row.name}
                  <span className="muted">
                    {" "}
                    · {row.count} {row.count === 1 ? "tx" : "txs"}
                  </span>
                </span>
                <span className={`legend-value ${toneClass}`.trim()}>
                  {formatMoney(row.total, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
