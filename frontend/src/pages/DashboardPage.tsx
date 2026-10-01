import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchCashflowHistory,
  fetchCashflowRolling12m,
  fetchNetWorth,
  type CashflowHistory,
  type CashflowRolling12m,
  type NetWorth,
  type NetWorthByBucket,
} from "../api/statisticsApi";
import { ChartCard } from "../components/ui/ChartCard";
import { KpiCard } from "../components/ui/KpiCard";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { useCurrency } from "../state/currency";
import { formatMoney, formatPercent } from "../utils/format";

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

function currentUtcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function DashboardPage() {
  const { accounts, accountsError, accountsLoading, currencies, currency } =
    useCurrency();

  const loadNetWorth = useCallback((): Promise<NetWorth | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchNetWorth(currency);
  }, [currency]);
  const {
    data: netWorth,
    error: netWorthError,
    loading: netWorthLoading,
  } = useAsyncData(loadNetWorth);

  const loadRolling = useCallback((): Promise<CashflowRolling12m | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchCashflowRolling12m(currency);
  }, [currency]);
  const {
    data: rolling,
    error: rollingError,
    loading: rollingLoading,
  } = useAsyncData(loadRolling);

  const loadHistory = useCallback((): Promise<CashflowHistory | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchCashflowHistory(currentUtcMonth(), currency, 12);
  }, [currency]);
  const {
    data: history,
    error: historyError,
    loading: historyLoading,
  } = useAsyncData(loadHistory);

  const loading =
    accountsLoading ||
    (!!currency && (netWorthLoading || rollingLoading || historyLoading));
  const error = accountsError || netWorthError || rollingError || historyError;

  const mixAccounts = useMemo(() => {
    if (!accounts || !currency) return [];
    return accounts
      .filter((a) => a.currency === currency)
      .sort((a, b) => b.totalBalance - a.totalBalance);
  }, [accounts, currency]);

  if (loading || error || currencies.length === 0) {
    return (
      <StatusBlock
        loading={loading}
        error={error}
        empty={currencies.length === 0}
        loadingMessage="Loading dashboard…"
        emptyMessage="Add an account to see net worth, cashflow, and account mix."
      />
    );
  }

  const savingsRate =
    rolling && rolling.avgIncome > 0
      ? (rolling.avgNet / rolling.avgIncome) * 100
      : null;

  return (
    <>
      <div className="kpi-grid">
        <KpiCard
          label={`Net worth (${currency})`}
          value={netWorth ? formatMoney(netWorth.netWorth, currency) : "—"}
          sub="Cash in the top-bar currency only. Other currencies are excluded. No FX, no holdings"
        />
        <KpiCard
          label="Avg income · 12m"
          value={rolling ? formatMoney(rolling.avgIncome, currency) : "—"}
          tone="positive"
          sub={rolling ? `${rolling.fromMonth} → ${rolling.toMonth}` : undefined}
        />
        <KpiCard
          label="Avg expense · 12m"
          value={rolling ? formatMoney(rolling.avgExpense, currency) : "—"}
          tone="negative"
          sub={rolling ? `${rolling.fromMonth} → ${rolling.toMonth}` : undefined}
        />
        <KpiCard
          label="Avg net · 12m"
          value={rolling ? formatMoney(rolling.avgNet, currency) : "—"}
          tone={rolling && rolling.avgNet < 0 ? "negative" : "positive"}
          sub={`Savings rate ${formatPercent(savingsRate, { decimals: 1 })}`}
        />
      </div>

      <div className="dash-grid">
        <ChartCard
          title="Cashflow — last 12 months"
          subtitle={`Monthly income, expense, and net in ${currency} (UTC months).`}
        >
          {history && history.series.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={history.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                <YAxis tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} width={70} />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number"
                      ? formatMoney(value, currency)
                      : String(value ?? "")
                  }
                />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="var(--chart-1)"
                  maxBarSize={22}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  name="Expense"
                  fill="var(--chart-3)"
                  maxBarSize={22}
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="Net"
                  stroke="var(--chart-4)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-state">No cashflow history yet.</p>
          )}
        </ChartCard>

        <ChartCard
          title="Net worth by type"
          subtitle="Cash balances grouped into account-type buckets."
        >
          {netWorth ? <NetWorthDonut data={netWorth} /> : null}
        </ChartCard>
      </div>

      <section className="card">
        <div className="chart-card-head">
          <div>
            <h2 className="section-title">Account mix ({currency})</h2>
            <p className="muted chart-card-subtitle">
              Accounts held in the selected currency.
            </p>
          </div>
          <Link to="/accounts" className="btn-secondary">
            Manage accounts
          </Link>
        </div>
        {mixAccounts.length === 0 ? (
          <p className="empty-state">No accounts in {currency}.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {mixAccounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <Link to={`/accounts/${account.id}`}>{account.name}</Link>
                    </td>
                    <td>
                      <span className="badge">{account.accountType}</span>
                    </td>
                    <td className="num">
                      {formatMoney(account.totalBalance, account.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function NetWorthDonut({ data }: { data: NetWorth }) {
  const slices = BUCKET_LABELS.map(({ key, label }, index) => ({
    key,
    name: label,
    value: data.byBucket[key],
    color: CHART_COLORS[index % CHART_COLORS.length]!,
  }));
  const nonZero = slices.filter((slice) => slice.value > 0);

  if (nonZero.length === 0) {
    return <p className="empty-state">No positive balances in {data.currency}.</p>;
  }

  return (
    <div className="donut-layout">
      <ResponsiveContainer width="100%" height={200}>
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
                ? formatMoney(value, data.currency)
                : String(value ?? "")
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="legend-list">
        {slices.map((slice) => (
          <li key={slice.key} className="legend-row">
            <span className="legend-name">
              <span
                className="legend-dot"
                style={{ background: slice.color }}
                aria-hidden
              />
              {slice.name}
            </span>
            <span className="legend-value">
              {formatMoney(slice.value, data.currency)}
            </span>
          </li>
        ))}
        <li className="legend-row legend-total">
          <span className="legend-name">Total</span>
          <span className="legend-value">
            {formatMoney(data.netWorth, data.currency)}
          </span>
        </li>
      </ul>
    </div>
  );
}
