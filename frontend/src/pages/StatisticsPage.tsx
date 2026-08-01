import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchCategories, type Category } from "../api/categoriesApi";
import {
  fetchCashflowHistory,
  fetchCategoryBreakdown,
  fetchPeriodSummary,
  type CategoryBreakdown,
  type CategoryBreakdownRow,
  type PeriodSummary,
} from "../api/statisticsApi";
import { ChartCard } from "../components/ui/ChartCard";
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

const HISTORY_MONTH_OPTIONS = [6, 12, 24] as const;

function currentUtcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

type RollupRow = {
  key: string;
  name: string;
  total: number;
  count: number;
};

function parentIdMap(categories: Category[]): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (const cat of categories) {
    map.set(cat.id, cat.parentId);
  }
  return map;
}

function nameById(categories: Category[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const cat of categories) {
    map.set(cat.id, cat.name);
  }
  return map;
}

/** Roll child category totals under root parent (Income / Expense); keep Uncategorized. */
function rollupByParent(
  rows: CategoryBreakdownRow[],
  currency: string,
  categories: Category[],
): RollupRow[] {
  const parents = parentIdMap(categories);
  const names = nameById(categories);
  const buckets = new Map<string, RollupRow>();

  for (const row of rows) {
    if (row.currency !== currency) continue;
    let label = "Uncategorized";
    let key = "uncategorized";
    if (row.categoryId != null) {
      let id: number | null = row.categoryId;
      let rootId = id;
      while (id != null) {
        rootId = id;
        id = parents.get(id) ?? null;
      }
      label = names.get(rootId) ?? row.categoryName;
      key = `cat-${rootId}`;
    }
    const existing = buckets.get(key);
    if (existing) {
      existing.total += row.total;
      existing.count += row.count;
    } else {
      buckets.set(key, { key, name: label, total: row.total, count: row.count });
    }
  }

  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

export function StatisticsPage() {
  const { currencies, currency } = useCurrency();
  const [month, setMonth] = useState(currentUtcMonth);
  const [historyMonths, setHistoryMonths] = useState<number>(12);

  const loadCategories = useCallback(() => fetchCategories(), []);
  const { data: categories } = useAsyncData(loadCategories);

  const loadBreakdown = useCallback(
    () => fetchCategoryBreakdown(month),
    [month],
  );
  const {
    data: breakdown,
    error: breakdownError,
    loading: breakdownLoading,
  } = useAsyncData(loadBreakdown);

  const loadSummary = useCallback((): Promise<PeriodSummary | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchPeriodSummary(month, currency);
  }, [month, currency]);
  const {
    data: summary,
    error: summaryError,
    loading: summaryLoading,
  } = useAsyncData(loadSummary);

  const loadHistory = useCallback(() => {
    if (!currency) {
      return Promise.resolve({ currency: "", monthCount: 0, series: [] });
    }
    return fetchCashflowHistory(month, currency, historyMonths);
  }, [month, currency, historyMonths]);
  const {
    data: history,
    error: historyError,
    loading: historyLoading,
  } = useAsyncData(loadHistory);

  const chartSeries = useMemo(() => {
    if (!history) return [];
    return history.series.map((point) => ({
      ...point,
      savingsRate:
        point.income > 0 ? (point.net / point.income) * 100 : null,
    }));
  }, [history]);

  const incomeRollup = useMemo(() => {
    if (!breakdown || !categories || !currency) return [];
    return rollupByParent(breakdown.income, currency, categories);
  }, [breakdown, categories, currency]);

  const expenseRollup = useMemo(() => {
    if (!breakdown || !categories || !currency) return [];
    return rollupByParent(breakdown.expense, currency, categories);
  }, [breakdown, categories, currency]);

  const loading =
    !!currency && (summaryLoading || historyLoading || breakdownLoading);
  const error = summaryError || historyError || breakdownError;

  return (
    <>
      <section className="card form-section-gap period-filter">
        <div className="period-filter-row">
          <label>
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
            />
          </label>
          <label>
            History range
            <select
              value={historyMonths}
              onChange={(e) => setHistoryMonths(Number(e.target.value))}
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
          Currency is set in the top bar
          {currency ? ` (${currency})` : ""}. Bounds are UTC. Category
          breakdown is filtered to the selected currency; parent categories are
          rolled up.
        </p>
      </section>

      <StatusBlock
        loading={loading}
        error={error}
        empty={currencies.length === 0}
        loadingMessage="Loading statistics…"
        emptyMessage="Add an account to see period KPIs and charts."
      />

      {!loading && !error && currency && summary && (
        <ul className="stat-list card">
          <li className="stat-row">
            <span className="stat-row-label">Income · {month}</span>
            <span className="stat-row-value positive">
              {formatMoney(summary.income, currency)}
            </span>
          </li>
          <li className="stat-row">
            <span className="stat-row-label">Expense · {month}</span>
            <span className="stat-row-value negative">
              {formatMoney(summary.expense, currency)}
            </span>
          </li>
          <li className="stat-row">
            <span className="stat-row-label">Net · {month}</span>
            <span
              className={`stat-row-value ${summary.net >= 0 ? "positive" : "negative"}`}
            >
              {formatMoney(summary.net, currency)}
            </span>
          </li>
        </ul>
      )}

      {!loading && !error && currency && history && (
        <ChartCard
          title={`Cashflow history (${currency})`}
          subtitle={`${historyMonths} months ending ${month}, with savings rate on the right axis.`}
        >
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis
                yAxisId="money"
                tick={{ fontSize: 12 }}
                width={70}
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                tick={{ fontSize: 12 }}
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
        </ChartCard>
      )}

      {!loading && !error && currency && breakdown && (
        <div className="dash-grid">
          <BreakdownPanel
            title="Income"
            rows={incomeRollup}
            currency={currency}
            tone="positive"
            emptyLabel="No income in this month for the selected currency."
          />
          <BreakdownPanel
            title="Expense"
            rows={expenseRollup}
            currency={currency}
            tone="negative"
            emptyLabel="No expenses in this month for the selected currency."
          />
        </div>
      )}

      {!loading && !error && currency && breakdown && (
        <CategoryDetailTables breakdown={breakdown} currency={currency} />
      )}
    </>
  );
}

function BreakdownPanel(props: {
  title: string;
  rows: RollupRow[];
  currency: string;
  tone: "positive" | "negative";
  emptyLabel: string;
}) {
  const { title, rows, currency, tone, emptyLabel } = props;
  return (
    <ChartCard
      title={`${title} by category`}
      subtitle={`Parent rollup · ${currency}`}
    >
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
                <span className={`legend-value stat-row-value ${tone}`}>
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

function CategoryDetailTables(props: {
  breakdown: CategoryBreakdown;
  currency: string;
}) {
  const income = props.breakdown.income.filter(
    (r) => r.currency === props.currency,
  );
  const expense = props.breakdown.expense.filter(
    (r) => r.currency === props.currency,
  );

  return (
    <div className="dash-grid">
      <DetailTable title="Income detail" rows={income} currency={props.currency} />
      <DetailTable
        title="Expense detail"
        rows={expense}
        currency={props.currency}
      />
    </div>
  );
}

function DetailTable(props: {
  title: string;
  rows: CategoryBreakdownRow[];
  currency: string;
}) {
  return (
    <section className="card form-section-gap">
      <h2 className="section-title">{props.title}</h2>
      {props.rows.length === 0 ? (
        <p className="empty-state">No rows.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Count</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => (
                <tr
                  key={`${row.categoryId ?? "null"}-${row.categoryName}-${row.currency}`}
                >
                  <td>{row.categoryName}</td>
                  <td className="num">{row.count}</td>
                  <td className="num">
                    {formatMoney(row.total, props.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
