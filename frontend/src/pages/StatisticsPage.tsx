import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchCategories } from "../api/categoriesApi";
import {
  fetchCashflowHistory,
  fetchCategoryBreakdown,
  fetchPeriodSummary,
  fetchTagBreakdown,
  type PeriodSummary,
  type StatsPeriod,
  type TagBreakdown,
} from "../api/statisticsApi";
import { BreakdownPanel } from "../components/statistics/BreakdownPanel";
import { CHART_COLORS } from "../components/statistics/chartColors";
import { DetailTable } from "../components/statistics/DetailTable";
import { TagDetailTable } from "../components/statistics/TagDetailTable";
import { ChartCard } from "../components/ui/ChartCard";
import { KpiCard } from "../components/ui/KpiCard";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { useCurrency } from "../state/currency";
import { buildCategoryTreeRows } from "../utils/categoryTreeStats";
import { formatMoney, formatPercent } from "../utils/format";
import {
  formatPeriodDelta,
  previousPeriodAnchor,
} from "../utils/periodCompare";
import {
  anchorForQuarter,
  anchorForYear,
  currentUtcMonth,
  quarterOf,
  YEAR_OPTIONS,
  yearOf,
} from "../utils/statisticsPeriod";
import {
  rollupByParent,
  tagRollupRows,
  withUntagged,
} from "../utils/statisticsRollup";

const HISTORY_MONTH_OPTIONS = [6, 12, 24] as const;
const PERIOD_OPTIONS: { value: StatsPeriod; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

type AnalysisView = "categories" | "tags";
type CategoryFacet = "income" | "expense" | "transfer";
type TagFacet = "income" | "expense";

export function StatisticsPage() {
  const { currencies, currency } = useCurrency();
  const [month, setMonth] = useState(currentUtcMonth);
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [historyMonths, setHistoryMonths] = useState<number>(12);
  const [analysisView, setAnalysisView] = useState<AnalysisView>("categories");
  const [categoryFacet, setCategoryFacet] = useState<CategoryFacet>("expense");
  const [tagFacet, setTagFacet] = useState<TagFacet>("expense");

  const loadCategories = useCallback(() => fetchCategories(), []);
  const { data: categories } = useAsyncData(loadCategories);

  const loadBreakdown = useCallback(
    () => fetchCategoryBreakdown(month, period),
    [month, period],
  );
  const {
    data: breakdown,
    error: breakdownError,
    loading: breakdownLoading,
  } = useAsyncData(loadBreakdown);

  const loadSummary = useCallback((): Promise<PeriodSummary | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchPeriodSummary(month, currency, period);
  }, [month, currency, period]);
  const {
    data: summary,
    error: summaryError,
    loading: summaryLoading,
  } = useAsyncData(loadSummary);

  const prevMonth = useMemo(
    () => previousPeriodAnchor(month, period),
    [month, period],
  );
  const loadPrevSummary = useCallback((): Promise<PeriodSummary | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchPeriodSummary(prevMonth, currency, period);
  }, [prevMonth, currency, period]);
  const { data: prevSummary } = useAsyncData(loadPrevSummary);

  const loadTags = useCallback((): Promise<TagBreakdown | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchTagBreakdown(month, currency, period);
  }, [month, currency, period]);
  const {
    data: tagBreakdown,
    error: tagError,
    loading: tagLoading,
  } = useAsyncData(loadTags);

  const loadHistory = useCallback(() => {
    if (!currency) {
      return Promise.resolve({ currency: "", monthCount: 0, series: [] });
    }
    return fetchCashflowHistory(month, currency, historyMonths, period);
  }, [month, currency, historyMonths, period]);
  const {
    data: history,
    error: historyError,
    loading: historyLoading,
  } = useAsyncData(loadHistory);

  const periodLabel = summary?.label ?? breakdown?.label ?? month;

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

  const transferRollup = useMemo(() => {
    if (!breakdown || !categories || !currency) return [];
    return rollupByParent(breakdown.transfer, currency, categories);
  }, [breakdown, categories, currency]);

  const tagIncomeRollup = useMemo(() => {
    if (!tagBreakdown) return [];
    return withUntagged(
      tagRollupRows(tagBreakdown.income),
      tagBreakdown.untagged.income,
      tagBreakdown.untagged.incomeCount,
    );
  }, [tagBreakdown]);

  const tagExpenseRollup = useMemo(() => {
    if (!tagBreakdown) return [];
    return withUntagged(
      tagRollupRows(tagBreakdown.expense),
      tagBreakdown.untagged.expense,
      tagBreakdown.untagged.expenseCount,
    );
  }, [tagBreakdown]);

  const loading =
    !!currency &&
    (summaryLoading || historyLoading || breakdownLoading || tagLoading);
  const error = summaryError || historyError || breakdownError || tagError;

  const categoryFacetRows =
    categoryFacet === "income"
      ? incomeRollup
      : categoryFacet === "expense"
        ? expenseRollup
        : transferRollup;

  const categoryDetailRows = useMemo((): CategoryTreeStatRow[] => {
    if (!breakdown || !categories || !currency) return [];
    const source =
      categoryFacet === "income"
        ? breakdown.income
        : categoryFacet === "expense"
          ? breakdown.expense
          : breakdown.transfer;
    return buildCategoryTreeRows(source, categories, currency);
  }, [breakdown, categories, currency, categoryFacet]);

  const tagFacetRows =
    tagFacet === "income" ? tagIncomeRollup : tagExpenseRollup;

  return (
    <>
      <section className="card form-section-gap period-filter">
        <div
          className="stats-segmented"
          role="group"
          aria-label="Analysis period"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={
                period === opt.value
                  ? "stats-segmented__btn stats-segmented__btn--active"
                  : "stats-segmented__btn"
              }
              aria-pressed={period === opt.value}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="period-filter-row">
          {period === "month" && (
            <label>
              Month
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
              />
            </label>
          )}
          {period === "quarter" && (
            <>
              <label>
                Year
                <select
                  value={yearOf(month)}
                  onChange={(e) =>
                    setMonth(
                      anchorForQuarter(Number(e.target.value), quarterOf(month)),
                    )
                  }
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quarter
                <select
                  value={quarterOf(month)}
                  onChange={(e) =>
                    setMonth(
                      anchorForQuarter(yearOf(month), Number(e.target.value)),
                    )
                  }
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      Q{q}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {period === "year" && (
            <label>
              Year
              <select
                value={yearOf(month)}
                onChange={(e) =>
                  setMonth(anchorForYear(Number(e.target.value)))
                }
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          )}
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
          Showing <strong>{periodLabel}</strong>
          {currency ? ` · ${currency}` : ""}. Currency is set in the top bar.
          Transfers are listed separately and do not change income, expense, or
          net. Tag totals count the full amount on each attached tag.
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
        <div className="kpi-grid">
          <KpiCard
            label={`Income · ${periodLabel}`}
            value={formatMoney(summary.income, currency)}
            tone="positive"
            sub={
              prevSummary
                ? formatPeriodDelta(summary.income, prevSummary.income)
                : undefined
            }
          />
          <KpiCard
            label={`Expense · ${periodLabel}`}
            value={formatMoney(summary.expense, currency)}
            tone="negative"
            sub={
              prevSummary
                ? formatPeriodDelta(summary.expense, prevSummary.expense)
                : undefined
            }
          />
          <KpiCard
            label={`Net · ${periodLabel}`}
            value={formatMoney(summary.net, currency)}
            tone={summary.net >= 0 ? "positive" : "negative"}
            sub={
              prevSummary
                ? formatPeriodDelta(summary.net, prevSummary.net)
                : undefined
            }
          />
          <KpiCard
            label={`Transfers · ${periodLabel}`}
            value={formatMoney(summary.transfers, currency)}
            sub={
              prevSummary
                ? formatPeriodDelta(summary.transfers, prevSummary.transfers)
                : undefined
            }
          />
        </div>
      )}

      {!loading && !error && currency && history && (
        <ChartCard
          title={`Cashflow history (${currency})`}
          subtitle={`${historyMonths} months ending ${periodLabel}, with savings rate on the right axis.`}
        >
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
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
            Legend: Income, Expense, and Net use the left axis. Savings % uses the right axis.
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
                {chartSeries.map((row) => (
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
      )}

      {!loading && !error && currency && (
        <section className="card form-section-gap stats-analysis">
          <div
            className="stats-segmented"
            role="tablist"
            aria-label="Breakdown view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={analysisView === "categories"}
              className={
                analysisView === "categories"
                  ? "stats-segmented__btn stats-segmented__btn--active"
                  : "stats-segmented__btn"
              }
              onClick={() => setAnalysisView("categories")}
            >
              Categories
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={analysisView === "tags"}
              className={
                analysisView === "tags"
                  ? "stats-segmented__btn stats-segmented__btn--active"
                  : "stats-segmented__btn"
              }
              onClick={() => setAnalysisView("tags")}
            >
              Tags
            </button>
          </div>

          {analysisView === "categories" && breakdown && (
            <>
              <div
                className="stats-facet-tabs"
                role="tablist"
                aria-label="Category type"
              >
                {(
                  [
                    ["income", "Income"],
                    ["expense", "Expense"],
                    ["transfer", "Transfers"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={categoryFacet === value}
                    className={
                      categoryFacet === value
                        ? "stats-facet-tabs__btn stats-facet-tabs__btn--active"
                        : "stats-facet-tabs__btn"
                    }
                    onClick={() => setCategoryFacet(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <BreakdownPanel
                title={
                  categoryFacet === "income"
                    ? "Income"
                    : categoryFacet === "expense"
                      ? "Expense"
                      : "Transfers"
                }
                rows={categoryFacetRows}
                currency={currency}
                tone={
                  categoryFacet === "income"
                    ? "positive"
                    : categoryFacet === "expense"
                      ? "negative"
                      : "neutral"
                }
                emptyLabel={`No ${categoryFacet} in ${periodLabel} for the selected currency.`}
                subtitle={`Root category rollup · ${periodLabel} · ${currency}`}
              />
              <DetailTable
                title={`${categoryFacet === "transfer" ? "Transfer" : categoryFacet === "income" ? "Income" : "Expense"} detail`}
                rows={categoryDetailRows}
                currency={currency}
              />
              {categoryDetailRows.length > 0 && (
                <p className="muted stats-detail-hint">
                  Totals include nested subcategories.
                </p>
              )}
            </>
          )}

          {analysisView === "tags" && tagBreakdown && (
            <>
              <div
                className="stats-facet-tabs"
                role="tablist"
                aria-label="Tag type"
              >
                {(
                  [
                    ["income", "Income"],
                    ["expense", "Expense"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tagFacet === value}
                    className={
                      tagFacet === value
                        ? "stats-facet-tabs__btn stats-facet-tabs__btn--active"
                        : "stats-facet-tabs__btn"
                    }
                    onClick={() => setTagFacet(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <BreakdownPanel
                title={tagFacet === "income" ? "Income" : "Expense"}
                rows={tagFacetRows}
                currency={currency}
                tone={tagFacet === "income" ? "positive" : "negative"}
                emptyLabel={`No tagged ${tagFacet} in ${periodLabel} for the selected currency.`}
                subtitle={`By tag · ${periodLabel} · ${currency}`}
                byLabel="tag"
              />
              <TagDetailTable
                title={`${tagFacet === "income" ? "Income" : "Expense"} by tag`}
                rows={
                  tagFacet === "income"
                    ? tagBreakdown.income
                    : tagBreakdown.expense
                }
                untaggedTotal={
                  tagFacet === "income"
                    ? tagBreakdown.untagged.income
                    : tagBreakdown.untagged.expense
                }
                untaggedCount={
                  tagFacet === "income"
                    ? tagBreakdown.untagged.incomeCount
                    : tagBreakdown.untagged.expenseCount
                }
                currency={currency}
              />
            </>
          )}
        </section>
      )}
    </>
  );
}
