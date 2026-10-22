import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAccount, fetchAccountBalanceHistory } from "../api/accountsApi";
import { fetchCategories } from "../api/categoriesApi";
import { fetchTags } from "../api/tagsApi";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
  exportTransactionsCsv,
  importTransactionsCsv,
  previewTransactionsImport,
  fetchTransactions,
  type CashTransaction,
  type CreateCashTransactionInput,
  type ImportCategoryMapping,
  type ImportCategoryPreview,
} from "../api/transactionsApi";
import { AccountBalanceChart } from "../components/account/AccountBalanceChart";
import { AccountLedgerHeader } from "../components/account/AccountLedgerHeader";
import { AccountSubtitle } from "../components/account/AccountSubtitle";
import { ImportCategoryMappingPanel } from "../components/account/ImportCategoryMappingPanel";
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

type PendingImport = {
  csv: string;
  rowCount: number;
  categories: ImportCategoryPreview[];
  skipped: number;
};

function formatImportSuccessMessage(result: {
  created: number;
  createdCategories: number;
  skipped: number;
}): string {
  const createdNote =
    result.createdCategories > 0
      ? `Imported ${result.created} transaction(s); created ${result.createdCategories} categor${result.createdCategories === 1 ? "y" : "ies"}.`
      : `Imported ${result.created} transaction(s).`;
  if (result.skipped <= 0) return createdNote;
  return `${createdNote} Skipped ${result.skipped} internal transfer row(s) — manage transfers on the Transfers page.`;
}

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

  const {
    data: history,
    error: historyError,
    loading: historyLoading,
    reload: reloadHistory,
  } = useAsyncData(loadHistory);

  const {
    data: categories,
    reload: reloadCategories,
  } = useAsyncData(loadCategories);

  const { data: tags } = useAsyncData(loadTags);

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
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(
    null,
  );

  async function refresh() {
    reloadAccount();
    reloadTx();
    reloadHistory();
    reloadCategories();
    refreshAccounts();
  }

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

  async function runImport(
    csv: string,
    categoryMappings: ImportCategoryMapping[],
  ) {
    setImportBusy(true);
    setActionErr(null);
    setImportMsg(null);
    try {
      const result = await importTransactionsCsv(
        accountId,
        csv,
        categoryMappings,
      );
      setImportMsg(formatImportSuccessMessage(result));
      setPendingImport(null);
      await refresh();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleImportCsvFile(file: File) {
    setActionErr(null);
    setImportMsg(null);
    setPendingImport(null);
    setImportBusy(true);
    try {
      const csv = await file.text();
      const preview = await previewTransactionsImport(accountId, csv);
      if (preview.categories.length === 0) {
        const result = await importTransactionsCsv(accountId, csv, []);
        setImportMsg(formatImportSuccessMessage(result));
        await refresh();
        return;
      }
      setPendingImport({
        csv,
        rowCount: preview.rowCount,
        categories: preview.categories,
        skipped: preview.skipped,
      });
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
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
        error={accountError}
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

      {pendingImport && (
        <>
          {pendingImport.skipped > 0 && (
            <p className="muted form-section-gap">
              Skipping {pendingImport.skipped} internal transfer row(s) — manage
              transfers on the Transfers page.
            </p>
          )}
          <ImportCategoryMappingPanel
            key={`${pendingImport.rowCount}-${pendingImport.categories.map((c) => c.path).join("|")}`}
            previewCategories={pendingImport.categories}
            ownedCategories={categories ?? []}
            rowCount={pendingImport.rowCount}
            busy={importBusy}
            onConfirm={(mappings) => {
              void runImport(pendingImport.csv, mappings);
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
        <StatusBlock
          loading={txLoading && transactions.length === 0}
          error={txError}
          loadingMessage="Loading ledger…"
        />
        {account && (!txLoading || transactions.length > 0 || !txError) && (
          <LedgerTable
            accountId={accountId}
            transactions={transactions}
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
        {!txLoading && !txError && transactions.length === 0 && (
          <p className="muted empty-state">
            No transactions in this view — use the row above to add one, or
            switch month / All time.
          </p>
        )}
      </section>
    </>
  );
}
