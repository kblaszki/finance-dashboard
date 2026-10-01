import { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAccount } from "../api/accountsApi";
import { fetchCategories } from "../api/categoriesApi";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
  exportTransactionsCsv,
  importTransactionsCsv,
  fetchTransactions,
  type CashTransaction,
  type CreateCashTransactionInput,
} from "../api/transactionsApi";
import { AccountLedgerHeader } from "../components/account/AccountLedgerHeader";
import { AccountSubtitle } from "../components/account/AccountSubtitle";
import { CashTransactionForm } from "../components/account/CashTransactionForm";
import { LedgerTable } from "../components/account/LedgerTable";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { useCurrency } from "../state/currency";

export function AccountDetailPage() {
  const { id } = useParams();
  const accountId = Number(id);
  const { refreshAccounts } = useCurrency();

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
    return fetchTransactions(accountId);
  }, [accountId]);

  const loadCategories = useCallback(() => fetchCategories(), []);

  const {
    data: account,
    error: accountError,
    loading: accountLoading,
    reload: reloadAccount,
  } = useAsyncData(loadAccount);

  const {
    data: transactions,
    error: txError,
    loading: txLoading,
    reload: reloadTx,
  } = useAsyncData(loadTx);

  const { data: categories } = useAsyncData(loadCategories);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of categories ?? []) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [categories]);

  const [showCreate, setShowCreate] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  async function refresh() {
    reloadAccount();
    reloadTx();
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

  async function handleImportCsvFile(file: File) {
    setActionErr(null);
    setImportMsg(null);
    setImportBusy(true);
    try {
      const csv = await file.text();
      const result = await importTransactionsCsv(accountId, csv);
      setImportMsg(`Imported ${result.created} transaction(s).`);
      await refresh();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleCreate(input: CreateCashTransactionInput) {
    await createTransaction(accountId, input);
    await refresh();
  }

  async function handleSaveTx(
    tx: CashTransaction,
    input: { amount: number; description: string | null },
  ) {
    await updateTransaction(accountId, tx.id, input);
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
        loading={accountLoading}
        error={accountError}
        loadingMessage="Loading account…"
      />

      {account && (
        <PageHeader
          title={account.name}
          subtitle={<AccountSubtitle account={account} />}
          actions={
            <AccountLedgerHeader
              showCreate={showCreate}
              exportBusy={exportBusy}
              importBusy={importBusy}
              onToggleCreate={() => setShowCreate((open) => !open)}
              onExport={() => void handleExportCsv()}
              onImportFile={handleImportCsvFile}
            />
          }
        />
      )}

      {actionErr && <p className="error-banner">{actionErr}</p>}
      {importMsg && <p className="success-banner">{importMsg}</p>}

      {showCreate && (
        <CashTransactionForm categories={categories ?? null} onSubmit={handleCreate} />
      )}

      <section className="card form-section-gap">
        <h2 className="section-title">Ledger</h2>
        <StatusBlock
          loading={txLoading}
          error={txError}
          empty={
            !txLoading && !txError && (transactions?.length ?? 0) === 0
          }
          loadingMessage="Loading ledger…"
          emptyMessage="No transactions yet."
        />
        {!txLoading && transactions && transactions.length > 0 && (
          <LedgerTable
            transactions={transactions}
            currency={account?.currency ?? null}
            categoryNameById={categoryNameById}
            onDelete={(tx) => void handleDelete(tx)}
            onSave={handleSaveTx}
            onActionError={setActionErr}
          />
        )}
      </section>
    </>
  );
}
