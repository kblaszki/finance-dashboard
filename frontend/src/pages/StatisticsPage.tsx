import { useCallback, useMemo, useState } from "react";
import { fetchCategories } from "../api/categoriesApi";
import {
  fetchCashflowHistory,
  fetchCashflowRolling12m,
  fetchCategoryBreakdown,
  fetchPeriodSummary,
  fetchTagBreakdown,
  type CashflowRolling12m,
  type PeriodSummary,
  type StatsPeriod,
  type TagBreakdown,
} from "../api/statisticsApi";
import { CashflowHistoryChart } from "../components/statistics/CashflowHistoryChart";
import { RollingCashflowStrip } from "../components/statistics/RollingCashflowStrip";
import {
  StatisticsAnalysisSection,
  type AnalysisView,
  type CategoryFacet,
  type TagFacet,
} from "../components/statistics/StatisticsAnalysisSection";
import { StatisticsKpiGrid } from "../components/statistics/StatisticsKpiGrid";
import { StatisticsPeriodFilter } from "../components/statistics/StatisticsPeriodFilter";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { useCurrency } from "../state/currency";
import {
  buildCategoryTreeRows,
  type CategoryTreeStatRow,
} from "../utils/categoryTreeStats";
import { previousPeriodAnchor } from "../utils/periodCompare";
import { currentUtcMonth } from "../utils/statisticsPeriod";
import {
  rollupByParent,
  tagRollupRows,
  withUntagged,
} from "../utils/statisticsRollup";

export function StatisticsPage() {
  const { currencies, currency } = useCurrency();
  const [month, setMonth] = useState(currentUtcMonth);
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [historyMonths, setHistoryMonths] = useState<number>(12);
  const [analysisView, setAnalysisView] = useState<AnalysisView>("categories");
  const [categoryFacet, setCategoryFacet] = useState<CategoryFacet>("expense");
  const [tagFacet, setTagFacet] = useState<TagFacet>("expense");

  const loadCategories = useCallback(() => fetchCategories(), []);
  const {
    data: categories,
    error: categoriesError,
  } = useAsyncData(loadCategories);

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
  const {
    data: prevSummary,
    error: prevSummaryError,
  } = useAsyncData(loadPrevSummary);

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

  const loadRolling = useCallback((): Promise<CashflowRolling12m | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchCashflowRolling12m(currency);
  }, [currency]);
  const {
    data: rolling,
    error: rollingError,
    loading: rollingLoading,
  } = useAsyncData(loadRolling);

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
    (summaryLoading ||
      historyLoading ||
      breakdownLoading ||
      tagLoading ||
      rollingLoading);
  const error =
    summaryError ||
    historyError ||
    breakdownError ||
    tagError ||
    rollingError ||
    categoriesError ||
    prevSummaryError;

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
      <StatisticsPeriodFilter
        period={period}
        month={month}
        historyMonths={historyMonths}
        periodLabel={periodLabel}
        currency={currency}
        onPeriodChange={setPeriod}
        onMonthChange={setMonth}
        onHistoryMonthsChange={setHistoryMonths}
      />

      <StatusBlock
        loading={loading}
        error={error}
        empty={currencies.length === 0}
        loadingMessage="Loading statistics…"
        emptyMessage="Add an account to see period KPIs and charts."
      />

      {!loading && !error && currency && summary && (
        <StatisticsKpiGrid
          summary={summary}
          prevSummary={prevSummary}
          periodLabel={periodLabel}
          currency={currency}
        />
      )}

      {!loading && !error && currency && rolling && (
        <RollingCashflowStrip rolling={rolling} currency={currency} />
      )}

      {!loading && !error && currency && history && (
        <CashflowHistoryChart
          series={chartSeries}
          currency={currency}
          historyMonths={historyMonths}
          periodLabel={periodLabel}
        />
      )}

      {!loading && !error && currency && (
        <StatisticsAnalysisSection
          analysisView={analysisView}
          categoryFacet={categoryFacet}
          tagFacet={tagFacet}
          periodLabel={periodLabel}
          currency={currency}
          breakdown={breakdown}
          tagBreakdown={tagBreakdown}
          categoryFacetRows={categoryFacetRows}
          categoryDetailRows={categoryDetailRows}
          tagFacetRows={tagFacetRows}
          onAnalysisViewChange={setAnalysisView}
          onCategoryFacetChange={setCategoryFacet}
          onTagFacetChange={setTagFacet}
        />
      )}
    </>
  );
}
