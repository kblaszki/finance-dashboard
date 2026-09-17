import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAccount, type Account } from "../api/accountsApi";
import {
  fetchCategories,
  flattenCategoryTree,
  type Category,
} from "../api/categoriesApi";
import {
  CASH_TX_TYPES,
  createTransaction,
  deleteTransaction,
  exportTransactionsCsv,
  importTransactionsCsv,
  fetchTransactions,
  type CashTxType,
  type CashTransaction,
} from "../api/transactionsApi";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { useCurrency } from "../state/currency";
import { formatMoney } from "../utils/format";

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

  const categoryRows = useMemo(
    () => (categories ? flattenCategoryTree(categories) : []),
    [categories],
  );

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of categories ?? []) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [categories]);

  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState<CashTxType>("INCOME");
  const [typeInput, setTypeInput] = useState("INCOME");
  const [typeError, setTypeError] = useState<string | null>(null);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [activeTypeIndex, setActiveTypeIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(defaultOccurredAtValue);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categoryInput, setCategoryInput] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const typeRef = useRef<HTMLInputElement | null>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);
  const categoryInputRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const typeBlurTimer = useRef<number | null>(null);
  const categoryBlurTimer = useRef<number | null>(null);

  const typeScopedCategoryRows = useMemo(() => {
    const allowed = categoryIdsUnderRoot(
      categories ?? [],
      rootNameForTxType(type),
    );
    return categoryRows.filter((cat) => allowed.has(cat.id));
  }, [categories, categoryRows, type]);

  const filteredTypeOptions = useMemo(() => {
    const query = typeInput.trim().toLowerCase();
    if (!query) return [...CASH_TX_TYPES];
    return CASH_TX_TYPES.filter((option) =>
      option.toLowerCase().includes(query),
    );
  }, [typeInput]);

  const filteredCategoryRows = useMemo(() => {
    const query = categoryInput.trim().toLowerCase();
    if (!query) return typeScopedCategoryRows;
    return typeScopedCategoryRows.filter((cat) =>
      cat.name.toLowerCase().includes(query),
    );
  }, [categoryInput, typeScopedCategoryRows]);

  useEffect(() => {
    if (!showCreate) return;
    window.setTimeout(() => {
      typeRef.current?.focus();
    }, 0);
  }, [showCreate]);

  useEffect(() => {
    return () => {
      if (typeBlurTimer.current) {
        window.clearTimeout(typeBlurTimer.current);
      }
      if (categoryBlurTimer.current) {
        window.clearTimeout(categoryBlurTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTypeOpen) {
      setActiveTypeIndex(0);
      return;
    }
    setActiveTypeIndex((current) =>
      filteredTypeOptions.length === 0
        ? 0
        : Math.min(current, filteredTypeOptions.length - 1),
    );
  }, [filteredTypeOptions, isTypeOpen]);

  useEffect(() => {
    if (!isCategoryOpen) {
      setActiveCategoryIndex(0);
      return;
    }
    setActiveCategoryIndex((current) =>
      filteredCategoryRows.length === 0
        ? 0
        : Math.min(current, filteredCategoryRows.length - 1),
    );
  }, [filteredCategoryRows, isCategoryOpen]);

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
      if (importFileRef.current) {
        importFileRef.current.value = "";
      }
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    if (!validateTypeInput()) return;
    if (!validateCategoryInput()) return;
    setCreateBusy(true);
    try {
      const value = Number(amount);
      await createTransaction(accountId, {
        type,
        amount: value,
        occurredAt: occurredAt.trim() ? new Date(occurredAt).toISOString() : undefined,
        description: description.trim() ? description.trim() : null,
        categoryId: categoryId === "" ? null : Number(categoryId),
      });
      setAmount("");
      setDescription("");
      selectType("INCOME");
      clearCategory();
      setCreateErr(null);
      typeRef.current?.focus();
      await refresh();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
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

  function openCreateForm() {
    setShowCreate(true);
    if (!occurredAt) {
      setOccurredAt(defaultOccurredAtValue());
    }
  }

  function clearCategoryIfOutsideType(nextType: CashTxType) {
    if (categoryId === "") return;
    const allowed = categoryIdsUnderRoot(
      categories ?? [],
      rootNameForTxType(nextType),
    );
    if (!allowed.has(Number(categoryId))) {
      clearCategory();
    }
  }

  function selectType(nextType: CashTxType) {
    setType(nextType);
    setTypeInput(nextType);
    setTypeError(null);
    setIsTypeOpen(false);
    clearCategoryIfOutsideType(nextType);
  }

  function validateTypeInput(): boolean {
    const trimmed = typeInput.trim();
    const exactMatch = CASH_TX_TYPES.find(
      (option) => option.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exactMatch) {
      selectType(exactMatch);
      return true;
    }
    setTypeError("Choose INCOME or EXPENSE from the list.");
    return false;
  }

  function handleTypeInputChange(value: string) {
    setTypeInput(value);
    setTypeError(null);
    setIsTypeOpen(true);
    const exactMatch = CASH_TX_TYPES.find(
      (option) => option.toLowerCase() === value.trim().toLowerCase(),
    );
    if (exactMatch) {
      setType(exactMatch);
      clearCategoryIfOutsideType(exactMatch);
    }
  }

  function handleTypeInputFocus() {
    if (typeBlurTimer.current) {
      window.clearTimeout(typeBlurTimer.current);
      typeBlurTimer.current = null;
    }
    setIsTypeOpen(true);
  }

  function handleTypeInputBlur() {
    typeBlurTimer.current = window.setTimeout(() => {
      setIsTypeOpen(false);
      validateTypeInput();
    }, 120);
  }

  function acceptActiveTypeOption(): boolean {
    if (!isTypeOpen || filteredTypeOptions.length === 0) return false;
    const active = filteredTypeOptions[activeTypeIndex]!;
    selectType(active);
    return true;
  }

  function handleTypeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isTypeOpen) {
        setIsTypeOpen(true);
        return;
      }
      setActiveTypeIndex((current) =>
        filteredTypeOptions.length === 0
          ? 0
          : Math.min(current + 1, filteredTypeOptions.length - 1),
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isTypeOpen) {
        setIsTypeOpen(true);
        return;
      }
      setActiveTypeIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (e.key === "Escape") {
      setIsTypeOpen(false);
      return;
    }
    if (e.key === "Tab" && !e.shiftKey && acceptActiveTypeOption()) {
      e.preventDefault();
      window.setTimeout(() => amountRef.current?.focus(), 0);
      return;
    }
    if (e.key === "Enter" && isTypeOpen && filteredTypeOptions.length > 0) {
      e.preventDefault();
      acceptActiveTypeOption();
    }
  }

  function validateCategoryInput(): boolean {
    const trimmed = categoryInput.trim();
    if (trimmed === "") {
      setCategoryId("");
      setCategoryError(null);
      return true;
    }
    if (categoryId !== "") {
      const allowed = categoryIdsUnderRoot(
        categories ?? [],
        rootNameForTxType(type),
      );
      if (allowed.has(Number(categoryId))) {
        setCategoryError(null);
        return true;
      }
    }
    const exactMatch = typeScopedCategoryRows.find(
      (cat) => cat.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exactMatch) {
      selectCategory(exactMatch.id, exactMatch.name);
      return true;
    }
    setCategoryError("Choose an existing category from the list.");
    return false;
  }

  function selectCategory(nextId: number | null, nextName: string) {
    setCategoryId(nextId == null ? "" : String(nextId));
    setCategoryInput(nextName);
    setCategoryError(null);
    setIsCategoryOpen(false);
  }

  function clearCategory() {
    setCategoryId("");
    setCategoryInput("");
    setCategoryError(null);
    setIsCategoryOpen(false);
  }

  function handleCategoryInputChange(value: string) {
    setCategoryInput(value);
    setCategoryId("");
    setCategoryError(null);
    setIsCategoryOpen(true);
  }

  function handleCategoryInputFocus() {
    if (categoryBlurTimer.current) {
      window.clearTimeout(categoryBlurTimer.current);
      categoryBlurTimer.current = null;
    }
    setIsCategoryOpen(true);
  }

  function handleCategoryInputBlur() {
    categoryBlurTimer.current = window.setTimeout(() => {
      setIsCategoryOpen(false);
      validateCategoryInput();
    }, 120);
  }

  function acceptActiveCategoryOption(): boolean {
    if (!isCategoryOpen || filteredCategoryRows.length === 0) return false;
    const active = filteredCategoryRows[activeCategoryIndex]!;
    selectCategory(active.id, active.name);
    return true;
  }

  function handleCategoryKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isCategoryOpen) {
        setIsCategoryOpen(true);
        return;
      }
      setActiveCategoryIndex((current) =>
        filteredCategoryRows.length === 0
          ? 0
          : Math.min(current + 1, filteredCategoryRows.length - 1),
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isCategoryOpen) {
        setIsCategoryOpen(true);
        return;
      }
      setActiveCategoryIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (e.key === "Escape") {
      setIsCategoryOpen(false);
      return;
    }
    if (e.key === "Tab" && !e.shiftKey && acceptActiveCategoryOption()) {
      e.preventDefault();
      window.setTimeout(() => dateRef.current?.focus(), 0);
      return;
    }
    if (e.key === "Enter" && isCategoryOpen && filteredCategoryRows.length > 0) {
      e.preventDefault();
      acceptActiveCategoryOption();
    }
  }

  function handleDateKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!e.ctrlKey) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setOccurredAt((current) =>
        shiftOccurredAtByDays(current || defaultOccurredAtValue(), -1),
      );
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setOccurredAt((current) =>
        shiftOccurredAtByDays(current || defaultOccurredAtValue(), 1),
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOccurredAt((current) =>
        shiftOccurredAtByHours(current || defaultOccurredAtValue(), 1),
      );
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOccurredAt((current) =>
        shiftOccurredAtByHours(current || defaultOccurredAtValue(), -1),
      );
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
            <div className="form-actions-row">
              <input
                ref={importFileRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportCsvFile(file);
                }}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => importFileRef.current?.click()}
                disabled={importBusy || exportBusy}
              >
                {importBusy ? "Uploading…" : "Upload CSV"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleExportCsv()}
                disabled={exportBusy || importBusy}
              >
                {exportBusy ? "Downloading…" : "Download CSV"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (showCreate) {
                    setShowCreate(false);
                  } else {
                    openCreateForm();
                  }
                }}
              >
                {showCreate ? "Hide form" : "Add transaction"}
              </button>
            </div>
          }
        />
      )}

      {actionErr && <p className="error-banner">{actionErr}</p>}
      {importMsg && <p className="success-banner">{importMsg}</p>}

      {showCreate && (
        <section className="card form-section-gap">
          <h2 className="section-title">Add cash movement</h2>
          <form className="auth-form cash-tx-form" onSubmit={handleCreate}>
            <label className="cash-tx-category-field">
              Type
              <div className="combobox">
                <input
                  ref={typeRef}
                  type="text"
                  value={typeInput}
                  onChange={(e) => handleTypeInputChange(e.target.value)}
                  onFocus={handleTypeInputFocus}
                  onBlur={handleTypeInputBlur}
                  onKeyDown={handleTypeKeyDown}
                  role="combobox"
                  aria-expanded={isTypeOpen}
                  aria-controls="cash-type-listbox"
                  aria-activedescendant={
                    isTypeOpen && filteredTypeOptions[activeTypeIndex]
                      ? `cash-type-option-${filteredTypeOptions[activeTypeIndex]!}`
                      : undefined
                  }
                  placeholder="INCOME or EXPENSE"
                  autoComplete="off"
                />
                {isTypeOpen && (
                  <div className="combobox-menu" role="listbox" id="cash-type-listbox">
                    {filteredTypeOptions.length > 0 ? (
                      filteredTypeOptions.map((option, index) => (
                        <button
                          key={option}
                          id={`cash-type-option-${option}`}
                          type="button"
                          role="option"
                          aria-selected={option === type}
                          className={`combobox-option ${
                            index === activeTypeIndex ? "active" : ""
                          }`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectType(option);
                          }}
                        >
                          <span className="combobox-option-name">{option}</span>
                        </button>
                      ))
                    ) : (
                      <p className="combobox-empty">No matching type.</p>
                    )}
                  </div>
                )}
              </div>
              {typeError && <p className="auth-error">{typeError}</p>}
            </label>
            <label>
              Amount
              <input
                ref={amountRef}
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="cash-tx-category-field">
              Category (optional)
              <div className="combobox">
                <input
                  ref={categoryInputRef}
                  type="text"
                  value={categoryInput}
                  onChange={(e) => handleCategoryInputChange(e.target.value)}
                  onFocus={handleCategoryInputFocus}
                  onBlur={handleCategoryInputBlur}
                  onKeyDown={handleCategoryKeyDown}
                  role="combobox"
                  aria-expanded={isCategoryOpen}
                  aria-controls="cash-category-listbox"
                  aria-activedescendant={
                    isCategoryOpen && filteredCategoryRows[activeCategoryIndex]
                      ? `cash-category-option-${filteredCategoryRows[activeCategoryIndex]!.id}`
                      : undefined
                  }
                  placeholder="Type to search categories"
                  autoComplete="off"
                />
                {categoryInput !== "" && (
                  <button
                    type="button"
                    className="combobox-clear"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={clearCategory}
                    aria-label="Clear category"
                  >
                    Clear
                  </button>
                )}
                {isCategoryOpen && (
                  <div className="combobox-menu" role="listbox" id="cash-category-listbox">
                    {filteredCategoryRows.length > 0 ? (
                      filteredCategoryRows.map((cat, index) => (
                        <button
                          key={cat.id}
                          id={`cash-category-option-${cat.id}`}
                          type="button"
                          role="option"
                          aria-selected={String(cat.id) === categoryId}
                          className={`combobox-option ${
                            index === activeCategoryIndex ? "active" : ""
                          }`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectCategory(cat.id, cat.name);
                          }}
                        >
                          <span
                            className="combobox-option-name"
                            style={{ paddingInlineStart: `${cat.depth * 0.9}rem` }}
                          >
                            {cat.name}
                          </span>
                          {cat.depth > 0 && (
                            <span className="combobox-option-meta">Nested</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="combobox-empty">No matching categories.</p>
                    )}
                  </div>
                )}
              </div>
              {categoryError && <p className="auth-error">{categoryError}</p>}
            </label>
            <label>
              Date
              <input
                ref={dateRef}
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                onKeyDown={handleDateKeyDown}
              />
            </label>
            <label>
              Description (optional)
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            {createErr && <p className="auth-error">{createErr}</p>}
            <button type="submit" className="btn-primary" disabled={createBusy}>
              {createBusy ? "Saving…" : "Add transaction (Enter)"}
            </button>
          </form>
        </section>
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
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="num">Amount</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatOccurredAt(tx.occurredAt)}</td>
                    <td>
                      <span
                        className={`badge ${tx.type === "INCOME" ? "badge-positive" : "badge-negative"}`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="num">
                      {account
                        ? formatMoney(tx.amount, account.currency)
                        : tx.amount}
                    </td>
                    <td>
                      {tx.categoryId != null ? (
                        <span className="badge">
                          {categoryNameById.get(tx.categoryId) ??
                            `#${tx.categoryId}`}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{tx.description ?? "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => void handleDelete(tx)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function AccountSubtitle({ account }: { account: Account }) {
  return (
    <>
      <span className="badge">{account.accountType}</span>
      {" · Balance "}
      <strong>{formatMoney(account.cashBalance, account.currency)}</strong>
      {account.openingCashAsOf && (
        <>
          {" · Opening as of "}
          {formatOccurredAt(account.openingCashAsOf)}
        </>
      )}
      {account.description ? ` · ${account.description}` : null}
    </>
  );
}

function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function defaultOccurredAtValue(): string {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return formatDateTimeLocal(now);
}

function shiftOccurredAtByDays(value: string, days: number): string {
  const base = new Date(value);
  if (Number.isNaN(base.getTime())) {
    return defaultOccurredAtValue();
  }
  base.setDate(base.getDate() + days);
  return formatDateTimeLocal(base);
}

function shiftOccurredAtByHours(value: string, hours: number): string {
  const base = new Date(value);
  if (Number.isNaN(base.getTime())) {
    return defaultOccurredAtValue();
  }
  base.setHours(base.getHours() + hours);
  return formatDateTimeLocal(base);
}

function formatDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function rootNameForTxType(type: CashTxType): "Income" | "Expense" {
  return type === "INCOME" ? "Income" : "Expense";
}

/** Root named Income/Expense plus all descendants (by parentId). */
function categoryIdsUnderRoot(
  categories: Category[],
  rootName: "Income" | "Expense",
): Set<number> {
  const root = categories.find(
    (cat) => cat.parentId == null && cat.name === rootName,
  );
  if (!root) return new Set();

  const byParent = new Map<number, Category[]>();
  for (const cat of categories) {
    if (cat.parentId == null) continue;
    const list = byParent.get(cat.parentId) ?? [];
    list.push(cat);
    byParent.set(cat.parentId, list);
  }

  const ids = new Set<number>();
  function walk(id: number) {
    ids.add(id);
    for (const child of byParent.get(id) ?? []) {
      walk(child.id);
    }
  }
  walk(root.id);
  return ids;
}
