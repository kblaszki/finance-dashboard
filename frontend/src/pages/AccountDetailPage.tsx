import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAccount, fetchAccountBalanceHistory } from "../api/accountsApi";
import { fetchCategories } from "../api/categoriesApi";
import { fetchTags } from "../api/tagsApi";
import {
  createImportPreset,
  createTransaction,
  deleteImportPreset,
  deleteTransaction,
  updateTransaction,
  exportTransactionsCsv,
  fetchTransactions,
  updateImportPreset,
  type CashTransaction,
  type CreateCashTransactionInput,
} from "../api/transactionsApi";
import { useCashLedgerImport } from "../hooks/useCashLedgerImport";
import { AccountBalanceChart } from "../components/account/AccountBalanceChart";
import { AccountLedgerHeader } from "../components/account/AccountLedgerHeader";
import { AccountSubtitle } from "../components/account/AccountSubtitle";
import { ImportCategoryMappingPanel } from "../components/account/ImportCategoryMappingPanel";
import { ImportColumnMappingPanel } from "../components/account/ImportColumnMappingPanel";
import { LedgerFilterBar } from "../components/account/LedgerFilterBar";
import { LedgerTable } from "../components/account/LedgerTable";
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
  EMPTY_LEDGER_FILTERS,
  filterLedgerRows,
  isLedgerFilterActive,
  type LedgerFilterState,
} from "../utils/listFilters";

export function AccountDetailPage() {
  const { id } = useParams();
  const accountId = Number(id);
  const { refreshAccounts } = useCurrency();
  const [historyMonths, setHistoryMonths] = useState(12);
  const [listMode, setListMode] = useState<ListViewMode>("month");
  const [month, setMonth] = useState(currentUtcMonth);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [filters, setFilters] = useState<LedgerFilterState>({
    ...EMPTY_LEDGER_FILTERS,
  });

  const loadAccount = useCallback(() => {
    if (!Number.isFinite(accountId) || accountId < 1) {
      return Promise.reject(new Error("Invalid account"));
    }
    return fetchAccount(accountId);
  }, [accountId]);

  const loadTx = useCallback(() => {
    if (!Number.isFinite(accountId) || accountId < 1) {
      return Promise.reject(new Error("Invalid account"));
    }
    if (listMode === "month") {
      return fetchTransactions(accountId, { month });
    }
    return fetchTransactions(accountId, { limit: 100 });
  }, [accountId, listMode, month]);

  const loadHistory = useCallback(() => {
    if (!Number.isFinite(accountId) || accountId < 1) {
      return Promise.reject(new Error("Invalid account"));
    }
    return fetchAccountBalanceHistory(accountId, { months: historyMonths });
  }, [accountId, historyMonths]);

  const loadCategories = useCallback(() => fetchCategories(), []);
  const loadTags = useCallback(() => fetchTags(), []);

  const {
    data: account,
    error: accountError,
    loading: accountLoading,
    reload: reloadAccount,
  } = useAsyncData(loadAccount);

  const {
    data: txPage,
    error: txError,
    loading: txLoading,
    reload: reloadTx,
  } = useAsyncData(loadTx);

  useEffect(() => {
    if (!txPage) return;
    setTransactions(txPage.items);
    setNextCursor(listMode === "all" ? txPage.nextCursor : null);
  }, [txPage, listMode]);

  const filteredTransactions = useMemo(
    () => filterLedgerRows(transactions, filters),
    [transactions, filters],
  );
  const filtersActive = isLedgerFilterActive(filters);

  const {
    data: history,
    error: historyError,
    loading: historyLoading,
    reload: reloadHistory,
  } = useAsyncData(loadHistory);

  const {
    data: categories,
    error: categoriesError,
    reload: reloadCategories,
  } = useAsyncData(loadCategories);

  const { data: tags, error: tagsError } = useAsyncData(loadTags);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of categories ?? []) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [categories]);

  const tagNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const tag of tags ?? []) {
      map.set(tag.id, tag.name);
    }
    return map;
  }, [tags]);

  const [actionErr, setActionErr] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  async function refresh() {
    reloadAccount();
    reloadTx();
    reloadHistory();
    reloadCategories();
    refreshAccounts();
  }

  const {
    importMsg,
    setImportMsg,
    importBusy,
    pendingImport,
    pendingColumnMap,
    setPendingImport,
    setPendingColumnMap,
    runImport,
    reloadColumnPresets,
    handleColumnMappingConfirm,
    handleImportCsvFile,
  } = useCashLedgerImport({
    accountId,
    onSuccess: refresh,
    setActionErr,
  });

  async function handleExportCsv() {
    setActionErr(null);
    setImportMsg(null);
    setExportBusy(true);
    try {
      const blob = await exportTransactionsCsv(accountId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeName = (account?.name ?? `account-${accountId}`)
        .replace(/[^\w.-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 64);
      anchor.href = url;
      anchor.download = `${safeName || `account-${accountId}`}-cash.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportBusy(false);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor || loadMoreBusy) return;
    setLoadMoreBusy(true);
    setActionErr(null);
    try {
      const page = await fetchTransactions(accountId, {
        limit: 100,
        cursor: nextCursor,
      });
      setTransactions((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Load more failed");
    } finally {
      setLoadMoreBusy(false);
    }
  }

  async function handleCreate(input: CreateCashTransactionInput) {
    const created = await createTransaction(accountId, input);
    if (created.occurredAt) {
      setListMode("month");
      setMonth(utcMonthFromIso(created.occurredAt));
    }
    await refresh();
  }

  async function handleSaveTx(
    tx: CashTransaction,
    patch: Partial<CreateCashTransactionInput>,
  ) {
    await updateTransaction(accountId, tx.id, patch);
    await refresh();
  }

  async function handleDelete(tx: CashTransaction) {
    if (!window.confirm(`Delete ${tx.type} of ${tx.amount}?`)) return;
    setActionErr(null);
    try {
      await deleteTransaction(accountId, tx.id);
      await refresh();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (!Number.isFinite(accountId) || accountId < 1) {
    return (
      <>
        <p className="error-banner">Invalid account id.</p>
        <p className="page-back-link">
          <Link to="/accounts">Back to accounts</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="page-back-link">
        <Link to="/accounts">← Accounts</Link>
      </p>

      <StatusBlock
        loading={accountLoading && !account}
        error={accountError || categoriesError || tagsError}
        loadingMessage="Loading account…"
      />

      {account && (
        <PageHeader
          title={account.name}
          subtitle={<AccountSubtitle account={account} />}
          actions={
            <AccountLedgerHeader
              exportBusy={exportBusy}
              importBusy={importBusy}
              onExport={() => void handleExportCsv()}
              onImportFile={handleImportCsvFile}
              transferOutTo={`/transfers?fromAccountId=${accountId}`}
            />
          }
        />
      )}

      {account && (
        <div className="form-section-gap">
          <AccountBalanceChart
            history={history}
            loading={historyLoading}
            error={historyError}
            currency={account.currency}
            months={historyMonths}
            onMonthsChange={setHistoryMonths}
          />
        </div>
      )}

      {actionErr && <p className="error-banner">{actionErr}</p>}
      {importMsg && <p className="success-banner">{importMsg}</p>}

      {pendingColumnMap && (
        <ImportColumnMappingPanel
          key={`${pendingColumnMap.columns.headers.join("|")}-${pendingColumnMap.columns.matchingPresetId ?? "none"}`}
          headers={pendingColumnMap.columns.headers}
          sampleRows={pendingColumnMap.columns.sampleRows}
          suggestedMapping={pendingColumnMap.columns.suggestedMapping}
          presets={pendingColumnMap.presets}
          matchingPresetId={pendingColumnMap.columns.matchingPresetId}
          busy={importBusy}
          onConfirm={(mapping) => {
            void handleColumnMappingConfirm(mapping);
          }}
          onCancel={() => setPendingColumnMap(null)}
          onSavePreset={async (name, mapping) => {
            await createImportPreset(accountId, {
              name,
              headers: pendingColumnMap.columns.headers,
              columnMapping: mapping,
            });
            await reloadColumnPresets();
          }}
          onUpdatePreset={async (presetId, mapping) => {
            await updateImportPreset(accountId, presetId, {
              headers: pendingColumnMap.columns.headers,
              columnMapping: mapping,
            });
            await reloadColumnPresets();
          }}
          onDeletePreset={async (presetId) => {
            await deleteImportPreset(accountId, presetId);
            await reloadColumnPresets();
          }}
        />
      )}

      {pendingImport && (
        <>
          {pendingImport.duplicateCount > 0 && (
            <div className="form-section-gap">
              <p className="muted">
                Skipping {pendingImport.duplicateCount} duplicate row(s) already
                on this account:
              </p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="num">Row</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th className="num">Amount</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingImport.skippedDuplicates.map((dup) => (
                      <tr key={`dup-${dup.row}`}>
                        <td className="num">{dup.row}</td>
                        <td>{dup.occurredAt}</td>
                        <td>
                          <span className="badge">{dup.type}</span>
                        </td>
                        <td className="num">{dup.amount.toFixed(2)}</td>
                        <td>{dup.description ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {pendingImport.skipped > 0 && (
            <p className="muted form-section-gap">
              Skipping {pendingImport.skipped} internal transfer row(s) — manage
              transfers on the Transfers page.
            </p>
          )}
          <ImportCategoryMappingPanel
            key={`${pendingImport.rowCount}-${pendingImport.categories.map((c) => c.path).join("|")}-${pendingImport.descriptionSuggestions.map((s) => s.descriptionKey).join("|")}`}
            previewCategories={pendingImport.categories}
            descriptionSuggestions={pendingImport.descriptionSuggestions}
            ownedCategories={categories ?? []}
            rowCount={pendingImport.rowCount}
            busy={importBusy}
            onConfirm={(categoryMappings, descriptionMappings) => {
              void runImport(
                pendingImport.csv,
                categoryMappings,
                descriptionMappings,
                pendingImport.columnMapping,
              );
            }}
            onCancel={() => setPendingImport(null)}
          />
        </>
      )}

      <section className="card form-section-gap">
        <h2 className="section-title">Ledger</h2>
        <MonthPager
          mode={listMode}
          month={month}
          onModeChange={setListMode}
          onMonthChange={setMonth}
          hasMore={nextCursor != null}
          loadMoreBusy={loadMoreBusy}
          onLoadMore={() => void handleLoadMore()}
        />
        <LedgerFilterBar
          filters={filters}
          onChange={setFilters}
          categories={categories ?? []}
          tags={tags ?? []}
        />
        <StatusBlock
          loading={txLoading && transactions.length === 0}
          error={txError}
          loadingMessage="Loading ledger…"
        />
        {account && (!txLoading || transactions.length > 0 || !txError) && (
          <LedgerTable
            accountId={accountId}
            transactions={filteredTransactions}
            currency={account.currency}
            categories={categories ?? []}
            categoryNameById={categoryNameById}
            tags={tags ?? []}
            tagNameById={tagNameById}
            onCreate={handleCreate}
            onCategoryCreated={() => {
              void reloadCategories();
            }}
            onDelete={(tx) => void handleDelete(tx)}
            onSave={handleSaveTx}
            onActionError={setActionErr}
          />
        )}
        {!txLoading &&
          !txError &&
          transactions.length === 0 &&
          !filtersActive && (
            <p className="muted empty-state">
              No transactions in this view — use the row above to add one, or
              switch month / All time.
            </p>
          )}
        {!txLoading &&
          !txError &&
          transactions.length > 0 &&
          filteredTransactions.length === 0 &&
          filtersActive && (
            <p className="empty-state" role="status">
              No rows match filters.{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => setFilters({ ...EMPTY_LEDGER_FILTERS })}
              >
                Clear
              </button>
            </p>
          )}
      </section>
    </>
  );
}
