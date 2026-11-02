import { useCallback, useMemo } from "react";
import { fetchCategories } from "../api/categoriesApi";
import {
  fetchNetWorth,
  fetchNetWorthHistory,
  fetchPeriodSummary,
  type NetWorth,
  type NetWorthHistory,
  type PeriodSummary,
} from "../api/statisticsApi";
import {
  fetchTransfers,
  type TransferListPage,
} from "../api/transfersApi";
import { AllocationCard } from "../components/dashboard/AllocationCard";
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

  const loadHistory = useCallback((): Promise<NetWorthHistory | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchNetWorthHistory(currency, 24, month);
  }, [currency, month]);
  const { data: history, error: historyError } = useAsyncData(loadHistory);

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
  const { data: prevSummary, error: prevSummaryError } =
    useAsyncData(loadPrevSummary);

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

  const setupLoading = accountsLoading || categoriesLoading;
  const setupError = accountsError || categoriesError;

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

  if (setupLoading || setupError) {
    return (
      <StatusBlock
        loading={setupLoading}
        error={setupError}
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

  if (!currency) {
    return (
      <StatusBlock
        loading={false}
        error="Dashboard data is incomplete for the selected currency."
      />
    );
  }

  return (
    <div className="dashboard-page page-stack">
      <div className="dash-top-row">
        <StatusBlock
          loading={netWorthLoading && !netWorth}
          error={netWorthError || historyError}
          loadingMessage="Loading net worth…"
        />
        {netWorth ? (
          <WealthHero
            netWorth={netWorth}
            history={history}
            currency={currency}
          />
        ) : null}
        <StatusBlock
          loading={summaryLoading && !summary}
          error={summaryError || prevSummaryError}
          loadingMessage="Loading period KPIs…"
        />
        {summary ? (
          <PeriodKpiStrip
            summary={summary}
            prevSummary={prevSummary ?? null}
            currency={currency}
            firstAccountId={firstAccountId}
          />
        ) : null}
      </div>
      <div className="dash-exec-grid">
        {netWorth ? <AllocationCard netWorth={netWorth} /> : null}
        <StatusBlock
          loading={transfersLoading && !transfersPage}
          error={transfersError}
          loadingMessage="Loading recent transfers…"
        />
        {transfersPage ? (
          <RecentActivityCard
            transfers={transfersPage.items}
            accounts={accounts ?? []}
          />
        ) : null}
      </div>
      <IdeasPanel ideas={ideas} />
    </div>
  );
}
