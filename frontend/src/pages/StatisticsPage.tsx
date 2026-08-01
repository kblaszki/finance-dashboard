import { useCallback, useEffect, useMemo, useState } from "react";
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
import { fetchAccounts } from "../api/accountsApi";
import {
  fetchCashflowHistory,
  fetchCategoryBreakdown,
  fetchPeriodSummary,
  type CategoryBreakdownRow,
  type PeriodSummary,
} from "../api/statisticsApi";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatMoney } from "../utils/format";

const HISTORY_MONTH_OPTIONS = [6, 12, 24] as const;

function currentUtcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function StatisticsPage() {
  const [month, setMonth] = useState(currentUtcMonth);
  const [currency, setCurrency] = useState("");
  const [historyMonths, setHistoryMonths] = useState<number>(12);

  const loadAccounts = useCallback(() => fetchAccounts(), []);
  const {
    data: accounts,
    error: accountsError,
    loading: accountsLoading,
  } = useAsyncData(loadAccounts);

  const currencies = useMemo(() => {
    if (!accounts) return [];
    return [...new Set(accounts.map((a) => a.currency))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [accounts]);

  useEffect(() => {
    if (currencies.length === 0) {
      setCurrency("");
      return;
    }
    setCurrency((current) =>
      current && currencies.includes(current) ? current : currencies[0]!,
    );
  }, [currencies]);

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

  const cashflowLoading =
    accountsLoading || (!!currency && (summaryLoading || historyLoading));
  const cashflowError = accountsError || summaryError || historyError;

  return (
    <div className="page-stack">
      <h1 className="page-title">Statistics</h1>
      <p className="muted">
        Period cashflow KPIs and history use one selected currency (no FX).
        Category breakdown lists all currencies for the month. Bounds are UTC.
      </p>

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
            Currency
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={currencies.length === 0}
            >
              {currencies.length === 0 ? (
                <option value="">No accounts</option>
              ) : (
                currencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))
              )}
            </select>
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
      </section>

      {cashflowLoading && <p className="muted">Loading cashflow…</p>}
      {cashflowError && <p className="error-banner">{cashflowError}</p>}

      {!cashflowLoading && !cashflowError && currencies.length === 0 && (
        <p className="empty-state">
          Add an account to see period KPIs and the cashflow chart.
        </p>
      )}

      {!cashflowLoading && !cashflowError && summary && currency && (
        <section className="card form-section-gap">
          <h2 className="section-title">Period summary ({currency})</h2>
          <ul className="stat-list">
            <li className="stat-row">
              <span className="stat-row-label">Income</span>
              <span className="stat-row-value positive">
                {formatMoney(summary.income, currency)}
              </span>
            </li>
            <li className="stat-row">
              <span className="stat-row-label">Expense</span>
              <span className="stat-row-value negative">
                {formatMoney(summary.expense, currency)}
              </span>
            </li>
            <li className="stat-row">
              <span className="stat-row-label">Net</span>
              <span
                className={`stat-row-value ${summary.net >= 0 ? "positive" : "negative"}`}
              >
                {formatMoney(summary.net, currency)}
              </span>
            </li>
          </ul>
        </section>
      )}

      {!cashflowLoading && !cashflowError && history && currency && (
        <section className="card form-section-gap">
          <h2 className="section-title">Cashflow history ({currency})</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={history.series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number"
                      ? formatMoney(value, currency)
                      : String(value ?? "")
                  }
                />
                <Legend />
                <Bar
                  dataKey="income"
                  name="Income"
                  fill="var(--color-positive)"
                  maxBarSize={28}
                />
                <Bar
                  dataKey="expense"
                  name="Expense"
                  fill="var(--color-negative)"
                  maxBarSize={28}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="Net"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {breakdownLoading && <p className="muted">Loading breakdown…</p>}
      {breakdownError && <p className="error-banner">{breakdownError}</p>}

      {!breakdownLoading && !breakdownError && breakdown && (
        <div className="two-col-grid">
          <BreakdownSection
            title="Income"
            rows={breakdown.income}
            tone="positive"
          />
          <BreakdownSection
            title="Expense"
            rows={breakdown.expense}
            tone="negative"
          />
        </div>
      )}
    </div>
  );
}

function BreakdownSection({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: CategoryBreakdownRow[];
  tone: "positive" | "negative";
}) {
  return (
    <section className="card form-section-gap">
      <h2 className="section-title">{title}</h2>
      {rows.length === 0 ? (
        <p className="empty-state">No {title.toLowerCase()} in this month.</p>
      ) : (
        <ul className="category-breakdown-list">
          {rows.map((row) => (
            <li
              key={`${row.categoryId ?? "null"}-${row.currency}-${row.categoryName}`}
            >
              <span>
                {row.categoryName}
                <span className="muted">
                  {" "}
                  · {row.currency} · {row.count}{" "}
                  {row.count === 1 ? "tx" : "txs"}
                </span>
              </span>
              <span className={`stat-row-value ${tone}`}>
                {formatMoney(row.total, row.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
