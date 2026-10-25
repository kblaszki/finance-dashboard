import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { type Account } from "../api/accountsApi";
import {
  fetchCategories,
} from "../api/categoriesApi";
import {
  createTransfer,
  exportTransfersCsv,
  fetchTransfers,
  type CashTransfer,
  type CreateTransferInput,
} from "../api/transfersApi";
import { TransferTable } from "../components/transfers/TransferTable";
import { useTransferImport } from "../hooks/useTransferImport";
import { categoriesForLedgerType } from "../components/account/categoryScope";
import { AccountLedgerHeader } from "../components/account/AccountLedgerHeader";
import { TransferFilterBar } from "../components/transfers/TransferFilterBar";
import { TransferImportPanel } from "../components/transfers/TransferImportPanel";
import {
  MonthPager,
  currentUtcMonth,
  utcMonthFromIso,
  type ListViewMode,
} from "../components/ui/MonthPager";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { useCurrency } from "../state/currency";
import {
  EMPTY_TRANSFER_FILTERS,
  filterTransferRows,
  isTransferFilterActive,
  type TransferFilterState,
} from "../utils/listFilters";
import {
  sortBy,
  type SortState,
} from "../utils/tableSort";

type TransferSortKey = "occurredAt" | "amountFrom" | "amountTo" | "description";

function parseFromAccountIdParam(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function TransfersPage() {
  const {
    accounts,
    accountsError,
    accountsLoading,
    refreshAccounts,
  } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [seedFromAccountId, setSeedFromAccountId] = useState<number | null>(
    () => parseFromAccountIdParam(searchParams.get("fromAccountId")),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [listMode, setListMode] = useState<ListViewMode>("month");
  const [month, setMonth] = useState(currentUtcMonth);
  const [transfers, setTransfers] = useState<CashTransfer[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [filters, setFilters] = useState<TransferFilterState>({
    ...EMPTY_TRANSFER_FILTERS,
  });
  const [sort, setSort] = useState<SortState<TransferSortKey> | null>(null);

  useEffect(() => {
    if (!searchParams.has("fromAccountId")) return;
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearSeedFromAccountId = useCallback(() => {
    setSeedFromAccountId(null);
  }, []);

  const loadTransfers = useCallback(() => {
    if (listMode === "month") {
      return fetchTransfers({ month });
    }
    return fetchTransfers({ limit: 100 });
  }, [listMode, month]);
  const {
    data: transfersPage,
    error: transfersError,
    loading: transfersLoading,
    reload: reloadTransfers,
  } = useAsyncData(loadTransfers);

  useEffect(() => {
    if (!transfersPage) return;
    setTransfers(transfersPage.items);
    setNextCursor(listMode === "all" ? transfersPage.nextCursor : null);
  }, [transfersPage, listMode]);

  const filteredTransfers = useMemo(
    () => filterTransferRows(transfers, filters),
    [transfers, filters],
  );
  const sortedTransfers = useMemo(
    () =>
      sortBy(filteredTransfers, sort, {
        occurredAt: (t) => t.occurredAt,
        amountFrom: (t) => t.amountFrom,
        amountTo: (t) => t.amountTo,
        description: (t) => t.description ?? "",
      }),
    [filteredTransfers, sort],
  );
  const filtersActive = isTransferFilterActive(filters);

  const loadCategories = useCallback(() => fetchCategories(), []);
  const {
    data: categories,
    error: categoriesError,
    loading: categoriesLoading,
    reload: reloadCategories,
  } = useAsyncData(loadCategories);

  const {
    importMsg,
    setImportMsg,
    importBusy,
    pendingImport,
    setPendingImport,
    handleImportCsvFile,
    handleImportContinue,
    handleImportConfirm,
  } = useTransferImport({
    setActionError,
    onSuccess: () => {
      reloadTransfers();
      refreshAccounts();
    },
  });

  const accountById = useMemo(() => {
    const map = new Map<number, Account>();
    for (const account of accounts ?? []) map.set(account.id, account);
    return map;
  }, [accounts]);

  const sortedAccounts = useMemo(
    () =>
      (accounts ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );

  const transferCategories = useMemo(
    () => categoriesForLedgerType(categories ?? [], "TRANSFER"),
    [categories],
  );

  async function handleLoadMore() {
    if (!nextCursor || loadMoreBusy) return;
    setLoadMoreBusy(true);
    setActionError(null);
    try {
      const page = await fetchTransfers({
        limit: 100,
        cursor: nextCursor,
      });
      setTransfers((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Load more failed");
    } finally {
      setLoadMoreBusy(false);
    }
  }

  async function handleCreate(input: CreateTransferInput) {
    const created = await createTransfer(input);
    if (created.occurredAt) {
      setListMode("month");
      setMonth(utcMonthFromIso(created.occurredAt));
    }
    reloadTransfers();
    refreshAccounts();
  }

  async function handleExportCsv() {
    setActionError(null);
    setImportMsg(null);
    setExportBusy(true);
    try {
      const blob = await exportTransfersCsv();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "transfers.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportBusy(false);
    }
  }

  const loading = transfersLoading || accountsLoading || categoriesLoading;
  const error = transfersError ?? accountsError ?? categoriesError;

  return (
    <>
      <PageHeader
        title="Transfers"
        subtitle="Move cash between your accounts. Ledger legs stay read-only. Double-click a cell to edit."
        actions={
          <AccountLedgerHeader
            exportBusy={exportBusy}
            importBusy={importBusy}
            onExport={() => void handleExportCsv()}
            onImportFile={handleImportCsvFile}
          />
        }
      />
      {actionError && <p className="error-banner">{actionError}</p>}
      {importMsg && <p className="success-banner">{importMsg}</p>}
      {pendingImport && (
        <TransferImportPanel
          key={pendingImport.csv.slice(0, 120)}
          accountsPreview={pendingImport.accounts}
          ownedAccounts={accounts ?? []}
          rowCount={pendingImport.rowCount}
          rows={pendingImport.rows}
          busy={importBusy}
          accountById={accountById}
          onContinue={(mappings) => {
            void handleImportContinue(mappings);
          }}
          onImport={(mappings, skipRows) => {
            void handleImportConfirm(mappings, skipRows);
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}
      <StatusBlock
        loading={loading}
        error={error}
        empty={false}
        loadingMessage="Loading transfers…"
      />
      {!loading && !error && (accounts?.length ?? 0) === 0 && (
        <p className="empty-state" role="status">
          No accounts yet.{" "}
          <Link to="/accounts">Create an account</Link> before recording
          transfers.
        </p>
      )}
      {!loading && !error && (accounts?.length ?? 0) > 0 && (
        <section className="card form-section-gap">
          <MonthPager
            mode={listMode}
            month={month}
            onModeChange={setListMode}
            onMonthChange={setMonth}
            hasMore={nextCursor != null}
            loadMoreBusy={loadMoreBusy}
            onLoadMore={() => void handleLoadMore()}
          />
          <TransferFilterBar
            filters={filters}
            onChange={setFilters}
            accounts={sortedAccounts}
            categories={transferCategories}
          />
          {filtersActive &&
            transfers.length > 0 &&
            filteredTransfers.length === 0 && (
              <p className="empty-state" role="status">
                No rows match filters.{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setFilters({ ...EMPTY_TRANSFER_FILTERS })}
                >
                  Clear
                </button>
              </p>
            )}
          <TransferTable
            transfers={sortedTransfers}
            accounts={sortedAccounts}
            accountById={accountById}
            transferCategories={transferCategories}
            sort={sort}
            onSortChange={setSort}
            seedFromAccountId={seedFromAccountId}
            onSeedConsumed={clearSeedFromAccountId}
            onCreate={handleCreate}
            onCategoryCreated={() => {
              void reloadCategories();
            }}
            onActionError={setActionError}
            onMutated={() => {
              reloadTransfers();
              refreshAccounts();
            }}
          />
        </section>
      )}
    </>
  );
}
