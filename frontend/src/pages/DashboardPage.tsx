import { useCallback, useMemo } from "react";
import { fetchCategories } from "../api/categoriesApi";
import {
  fetchCashflowHistory,
  fetchNetWorth,
  fetchPeriodSummary,
  type CashflowHistory,
  type NetWorth,
  type PeriodSummary,
} from "../api/statisticsApi";
import {
  fetchTransfers,
  type TransferListPage,
} from "../api/transfersApi";
import { AllocationCard } from "../components/dashboard/AllocationCard";
import { GoalsEmptyCard } from "../components/dashboard/GoalsEmptyCard";
import { IdeasPanel } from "../components/dashboard/IdeasPanel";
import { PeriodKpiStrip } from "../components/dashboard/PeriodKpiStrip";
import { RecentActivityCard } from "../components/dashboard/RecentActivityCard";
import { WealthHero } from "../components/dashboard/WealthHero";
import {
  SetupChecklist,
  hasCashActivityFromAccounts,
  isSetupComplete,
} from "../components/ui/SetupChecklist";
import { StatusBlock } from "../components/ui/StatusBlock";
import { currentUtcMonth, shiftMonth } from "../components/ui/MonthPager";
import { useAsyncData } from "../hooks/useAsyncData";
import { useCurrency } from "../state/currency";
import { buildDashboardIdeas } from "../utils/dashboardIdeas";

export function DashboardPage() {
  const { accounts, accountsError, accountsLoading, currencies, currency } =
    useCurrency();

  const month = currentUtcMonth();
  const prevMonth = shiftMonth(month, -1);

  const loadNetWorth = useCallback((): Promise<NetWorth | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchNetWorth(currency);
  }, [currency]);
  const {
    data: netWorth,
    error: netWorthError,
    loading: netWorthLoading,
  } = useAsyncData(loadNetWorth);

  const loadHistory = useCallback((): Promise<CashflowHistory | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchCashflowHistory(month, currency, 12);
  }, [currency, month]);
  const {
    data: history,
    error: historyError,
    loading: historyLoading,
  } = useAsyncData(loadHistory);

  const loadSummary = useCallback((): Promise<PeriodSummary | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchPeriodSummary(month, currency);
  }, [currency, month]);
  const {
    data: summary,
    error: summaryError,
    loading: summaryLoading,
  } = useAsyncData(loadSummary);

  const loadPrevSummary = useCallback((): Promise<PeriodSummary | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchPeriodSummary(prevMonth, currency);
  }, [currency, prevMonth]);
  const {
    data: prevSummary,
    error: prevSummaryError,
    loading: prevSummaryLoading,
  } = useAsyncData(loadPrevSummary);

  const loadTransfers = useCallback((): Promise<TransferListPage> => {
    return fetchTransfers({ limit: 8 });
  }, []);
  const {
    data: transfersPage,
    error: transfersError,
    loading: transfersLoading,
  } = useAsyncData(loadTransfers);

  const loadCategories = useCallback(() => fetchCategories(), []);
  const {
    data: categories,
    error: categoriesError,
    loading: categoriesLoading,
  } = useAsyncData(loadCategories);

  const loading =
    accountsLoading ||
    categoriesLoading ||
    transfersLoading ||
    (!!currency &&
      (netWorthLoading ||
        historyLoading ||
        summaryLoading ||
        prevSummaryLoading));
  const error =
    accountsError ||
    categoriesError ||
    netWorthError ||
    historyError ||
    summaryError ||
    prevSummaryError ||
    transfersError;

  const hasAccounts = (accounts?.length ?? 0) > 0;
  const hasCategories = (categories ?? []).some(
    (c) => c.ledgerType === "INCOME" || c.ledgerType === "EXPENSE",
  );
  const hasCashActivity = hasCashActivityFromAccounts(accounts ?? []);
  const setupDone = isSetupComplete({
    hasAccounts,
    hasCategories,
    hasCashActivity,
  });
  const firstAccountId = accounts?.[0]?.id ?? null;

  const ideas = useMemo(
    () =>
      buildDashboardIdeas({
        currency: currency ?? "USD",
        summary: summary ?? null,
        netWorth: netWorth ?? null,
      }),
    [currency, summary, netWorth],
  );

  if (loading || error) {
    return (
      <StatusBlock
        loading={loading}
        error={error}
        loadingMessage="Loading dashboard…"
      />
    );
  }

  if (currencies.length === 0 || !setupDone) {
    return (
      <>
        <SetupChecklist
          hasAccounts={hasAccounts}
          hasCategories={hasCategories}
          hasCashActivity={hasCashActivity}
          firstAccountId={firstAccountId}
        />
        {currencies.length === 0 ? (
          <p className="empty-state muted" role="status">
            Add an account to see net worth, cashflow, and allocation.
          </p>
        ) : null}
      </>
    );
  }

  if (!currency || !netWorth || !summary) {
    return (
      <StatusBlock
        loading={false}
        error="Dashboard data is incomplete for the selected currency."
      />
    );
  }

  return (
    <div className="dashboard-page page-stack">
      <WealthHero
        netWorth={netWorth}
        history={history}
        currency={currency}
      />
      <PeriodKpiStrip
        summary={summary}
        prevSummary={prevSummary ?? null}
        currency={currency}
      />
      <div className="dash-exec-grid">
        <AllocationCard netWorth={netWorth} />
        <GoalsEmptyCard />
        <IdeasPanel ideas={ideas} />
        <RecentActivityCard
          transfers={transfersPage?.items ?? []}
          accounts={accounts ?? []}
        />
      </div>
    </div>
  );
}
