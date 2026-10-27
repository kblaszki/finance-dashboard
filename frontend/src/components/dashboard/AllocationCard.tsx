import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { NetWorth, NetWorthByBucket } from "../../api/statisticsApi";
import { formatMoney } from "../../utils/format";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

const BUCKET_LABELS: { key: keyof NetWorthByBucket; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "stock", label: "Stock" },
  { key: "crypto", label: "Crypto" },
  { key: "metal", label: "Metal" },
  { key: "real_estate", label: "Real estate" },
  { key: "other", label: "Other" },
];

function investedTotal(data: NetWorth): number {
  const b = data.byBucket;
  return b.stock + b.crypto + b.metal + b.real_estate + b.other;
}

export function AllocationCard(props: { netWorth: NetWorth }) {
  const { netWorth } = props;
  const slices = BUCKET_LABELS.map(({ key, label }, index) => ({
    key,
    name: label,
    value: netWorth.byBucket[key],
    color: CHART_COLORS[index % CHART_COLORS.length]!,
  }));
  const nonZero = slices.filter((slice) => slice.value > 0);
  const invested = investedTotal(netWorth);
  const totalPositive = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  return (
    <article className="card dash-panel">
      <div className="chart-card-head">
        <div>
          <h2 className="section-title">Portfolio allocation</h2>
          <p className="muted chart-card-subtitle">
            Cash balances by account-type bucket.
          </p>
        </div>
        <Link to="/accounts" className="btn-secondary">
          Manage accounts
        </Link>
      </div>
      {nonZero.length === 0 ? (
        <p className="empty-state">
          No positive balances in {netWorth.currency}.
        </p>
      ) : (
        <div className="donut-layout">
          <div className="dash-donut-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={nonZero}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="90%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {nonZero.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number"
                      ? formatMoney(value, netWorth.currency)
                      : String(value ?? "")
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="dash-donut-center" aria-hidden>
              <b>{formatMoney(invested, netWorth.currency)}</b>
              <small>invested</small>
            </div>
          </div>
          <ul className="legend-list">
            {slices.map((slice) => {
              const pct =
                totalPositive > 0 && slice.value > 0
                  ? (slice.value / totalPositive) * 100
                  : null;
              return (
                <li key={slice.key} className="legend-row">
                  <span className="legend-name">
                    <span
                      className="legend-dot"
                      style={{ background: slice.color }}
                      aria-hidden
                    />
                    {slice.name}
                  </span>
                  <span className="legend-meta">
                    {pct != null ? (
                      <em className="legend-pct">{pct.toFixed(0)}%</em>
                    ) : null}
                    <span className="legend-value">
                      {formatMoney(slice.value, netWorth.currency)}
                    </span>
                  </span>
                </li>
              );
            })}
            {netWorth.liabilities > 0 ? (
              <li className="legend-row">
                <span className="legend-name">Liabilities</span>
                <span className="legend-value">
                  −{formatMoney(netWorth.liabilities, netWorth.currency)}
                </span>
              </li>
            ) : null}
            <li className="legend-row legend-total">
              <span className="legend-name">Net worth</span>
              <span className="legend-value">
                {formatMoney(netWorth.netWorth, netWorth.currency)}
              </span>
            </li>
          </ul>
        </div>
      )}
    </article>
  );
}
