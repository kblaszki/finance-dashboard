import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NetWorth, NetWorthHistory } from "../../api/statisticsApi";
import { formatMoney } from "../../utils/format";

export type ChartRange = 6 | 12 | 24;

const RANGE_OPTIONS: { months: ChartRange; label: string }[] = [
  { months: 6, label: "6M" },
  { months: 12, label: "1Y" },
  { months: 24, label: "2Y" },
];

function investedTotal(data: NetWorth): number {
  const b = data.byBucket;
  return b.stock + b.crypto + b.metal + b.real_estate + b.other;
}

function shortMonth(month: string): string {
  const d = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

export function sliceNetWorthHistory(
  history: NetWorthHistory | null,
  range: ChartRange,
): { month: string; asOf: string; netWorth: number; label: string }[] {
  const points = history?.series ?? [];
  return points.slice(-range).map((p) => ({
    ...p,
    label: shortMonth(p.month),
  }));
}

export function WealthHero(props: {
  netWorth: NetWorth;
  history: NetWorthHistory | null;
  currency: string;
}) {
  const { netWorth, history, currency } = props;
  const [range, setRange] = useState<ChartRange>(12);

  const series = useMemo(
    () => sliceNetWorthHistory(history, range),
    [history, range],
  );

  const cash = netWorth.byBucket.cash;
  const invested = investedTotal(netWorth);
  const rateDates = (netWorth.ratesUsed ?? [])
    .map((r) => `${r.currency} ${r.mid} (${r.rateDate})`)
    .join(", ");

  const rangeChange = useMemo(() => {
    if (series.length < 2) return null;
    const first = series[0]!.netWorth;
    const last = series[series.length - 1]!.netWorth;
    const abs = last - first;
    const pct = first !== 0 ? (abs / Math.abs(first)) * 100 : null;
    return { abs, pct };
  }, [series]);

  return (
    <section className="wealth-hero card">
      <div className="wealth-hero-copy">
        <span className="wealth-hero-overline">Total net worth</span>
        <h2 className="wealth-hero-value">
          {formatMoney(netWorth.netWorth, currency)}
        </h2>
        {rangeChange ? (
          <p
            className={
              rangeChange.abs >= 0
                ? "wealth-hero-delta positive"
                : "wealth-hero-delta negative"
            }
          >
            {formatMoney(rangeChange.abs, currency)}
            {rangeChange.pct != null
              ? ` (${rangeChange.pct >= 0 ? "+" : ""}${rangeChange.pct.toFixed(1)}%)`
              : ""}{" "}
            over last {range}m
          </p>
        ) : null}
        <p className="muted wealth-hero-note">
          {netWorth.asOf
            ? `Cash + holdings MTM converted to ${currency} via NBP mid rates · as of ${netWorth.asOf}.`
            : `Cash + holdings MTM converted to ${currency} via NBP mid rates.`}
        </p>
        {rateDates ? (
          <p className="muted wealth-hero-note">Rates: {rateDates}</p>
        ) : null}
        <div className="wealth-hero-chips">
          <span>Cash {formatMoney(cash, currency)}</span>
          <span>Invested {formatMoney(invested, currency)}</span>
          {netWorth.liabilities > 0 ? (
            <span>
              Debt −{formatMoney(netWorth.liabilities, currency)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="wealth-hero-chart">
        <div className="wealth-chart-head">
          <span className="muted">
            Is net worth growing? · last {range}m
          </span>
          <div className="wealth-chart-range" role="group" aria-label="Chart range">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.months}
                type="button"
                className={
                  range === opt.months
                    ? "wealth-range-btn wealth-range-btn--active"
                    : "wealth-range-btn"
                }
                onClick={() => setRange(opt.months)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {series.length > 0 ? (
          <div className="chart-plot chart-plot--sm">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="dashNetArea" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
                width={64}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) =>
                  typeof value === "number"
                    ? formatMoney(value, currency)
                    : String(value ?? "")
                }
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as
                    | { month?: string; asOf?: string }
                    | undefined;
                  if (!point?.month) return "";
                  return point.asOf
                    ? `${point.month} · as of ${point.asOf}`
                    : point.month;
                }}
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                name="Net worth"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#dashNetArea)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        ) : (
          <p className="empty-state">No net-worth history yet.</p>
        )}
        {history?.ratesUsed && history.ratesUsed.length > 0 ? (
          <p className="muted wealth-hero-note">
            History rates:{" "}
            {history.ratesUsed
              .map((r) => `${r.currency} ${r.mid} (${r.rateDate})`)
              .join(", ")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
