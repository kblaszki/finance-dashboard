import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  createCategory,
  deleteCategory,
  exportCategoriesCsv,
  fetchCategories,
  flattenCategoryTree,
  importCategoriesCsv,
  previewCategoriesImport,
  updateCategory,
  type CategoriesImportPreview,
  type Category,
  type CategoryLedgerType,
} from "../api/categoriesApi";
import {
  createCategoryDescriptionRule,
  deleteCategoryDescriptionRule,
  fetchCategoryDescriptionRules,
  type CategoryDescriptionRule,
} from "../api/categoryDescriptionRulesApi";
import type { CashTxType } from "../api/transactionsApi";
import { AccountLedgerHeader } from "../components/account/AccountLedgerHeader";
import { PageHeader } from "../components/ui/PageHeader";
import { SortableTh } from "../components/ui/SortableTh";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import {
  sortBy,
  toggleSort,
  type SortState,
} from "../utils/tableSort";

function parseLedgerTypeParam(value: string | null): CategoryLedgerType | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "INCOME" || raw === "EXPENSE" || raw === "TRANSFER") return raw;
  return null;
}

type PendingCategoriesImport = {
  csv: string;
  preview: CategoriesImportPreview;
};

const SECTIONS: Array<{ ledgerType: CategoryLedgerType; title: string }> = [
  { ledgerType: "INCOME", title: "Income" },
  { ledgerType: "EXPENSE", title: "Expense" },
  { ledgerType: "TRANSFER", title: "Transfers" },
];

type TreeRow = Category & { depth: number };
type EditableField = "name" | "parentId";
type EditingState = { categoryId: number; field: EditableField };

function CategoryCreateRow(props: {
  ledgerType: CategoryLedgerType;
  parentOptions: TreeRow[];
  onCreate: (input: {
    name: string;
    parentId: number | null;
    ledgerType: CategoryLedgerType;
  }) => Promise<void>;
  onActionError: (message: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (focusNonce === 0) return;
    const id = window.setTimeout(() => {
      nameRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [focusNonce]);

  async function submit() {
    props.onActionError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      props.onActionError("Name required");
      return;
    }
    setCreateBusy(true);
    try {
      const parent = parentId === "" ? null : Number(parentId);
      await props.onCreate({
        name: trimmed,
        parentId: parent,
        ledgerType: props.ledgerType,
      });
      setName("");
      setParentId("");
      setCreateBusy(false);
      setFocusNonce((n) => n + 1);
    } catch (err) {
      props.onActionError(err instanceof Error ? err.message : "Create failed");
      setCreateBusy(false);
    }
  }

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  function onFieldKeyDown(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void submit();
  }

  return (
    <tr className="ledger-create-row">
      <td>
        <input
          ref={nameRef}
          type="text"
          className="ledger-cell-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New category name"
          placeholder="Name"
        />
      </td>
      <td>
        <select
          className="ledger-cell-input"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New category parent"
        >
          <option value="">— Root —</option>
          {props.parentOptions.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {"\u00A0".repeat(cat.depth * 2)}
              {cat.name}
            </option>
          ))}
        </select>
      </td>
      <td className="col-actions">
        <form className="form-actions-row" onSubmit={onFormSubmit}>
          <button
            type="submit"
            className="btn-primary"
            disabled={createBusy}
            aria-label="Add category"
          >
            {createBusy ? "…" : "Add"}
          </button>
        </form>
      </td>
    </tr>
  );
}

function CategoryRow(props: {
  category: TreeRow;
  parentOptions: TreeRow[];
  parentName: string;
  draft: string;
  editBusy: boolean;
  isEditing: (categoryId: number, field: EditableField) => boolean;
  cellClass: (categoryId: number, field: EditableField, extra?: string) => string;
  onStartEdit: (category: TreeRow, field: EditableField) => void;
  onDraftChange: (value: string) => void;
  onEditorKeyDown: (e: KeyboardEvent, category: TreeRow) => void;
  onEditorBlur: () => void;
  onDelete: (category: Category) => void;
}) {
  const { category } = props;

  return (
    <tr>
      <td
        className={props.cellClass(category.id, "name", "col-text")}
        title="Double-click to edit"
        onDoubleClick={() => props.onStartEdit(category, "name")}
      >
        {props.isEditing(category.id, "name") ? (
          <input
            type="text"
            className="ledger-cell-input"
            value={props.draft}
            disabled={props.editBusy}
            autoFocus
            onChange={(e) => props.onDraftChange(e.target.value)}
            onKeyDown={(e) => props.onEditorKeyDown(e, category)}
            onBlur={props.onEditorBlur}
            aria-label="Edit name"
          />
        ) : (
          <span
            className={category.depth === 0 ? "category-root" : undefined}
            style={{ paddingInlineStart: `${category.depth * 1.25}rem` }}
          >
            {category.name}
          </span>
        )}
      </td>
      <td
        className={props.cellClass(category.id, "parentId", "col-text")}
        title="Double-click to edit"
        onDoubleClick={() => props.onStartEdit(category, "parentId")}
      >
        {props.isEditing(category.id, "parentId") ? (
          <select
            className="ledger-cell-input"
            value={props.draft}
            disabled={props.editBusy}
            autoFocus
            onChange={(e) => props.onDraftChange(e.target.value)}
            onKeyDown={(e) => props.onEditorKeyDown(e, category)}
            onBlur={props.onEditorBlur}
            aria-label="Edit parent"
          >
            <option value="">— Root —</option>
            {props.parentOptions
              .filter((c) => c.id !== category.id)
              .map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {"\u00A0".repeat(cat.depth * 2)}
                  {cat.name}
                </option>
              ))}
          </select>
        ) : (
          props.parentName
        )}
      </td>
      <td className="col-actions">
        <div className="form-actions-row">
          <button
            type="button"
            className="btn-danger"
            aria-label={`Delete ${category.name}`}
            onClick={() => props.onDelete(category)}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export function CategoriesPage() {
  const [searchParams] = useSearchParams();
  const focusLedgerType = parseLedgerTypeParam(searchParams.get("ledgerType"));

  useEffect(() => {
    if (!focusLedgerType) return;
    const el = document.getElementById(`category-section-${focusLedgerType}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    const input = el?.querySelector<HTMLInputElement>(
      'input[aria-label="New category name"]',
    );
    const id = window.setTimeout(() => {
      input?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [focusLedgerType]);

  const loadCategories = useCallback(() => fetchCategories(), []);
  const { data: categories, error, loading, reload } = useAsyncData(loadCategories);
  const loadRules = useCallback(() => fetchCategoryDescriptionRules(), []);
  const {
    data: descriptionRules,
    error: rulesError,
    loading: rulesLoading,
    reload: reloadRules,
  } = useAsyncData(loadRules);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [rulePattern, setRulePattern] = useState("");
  const [ruleLedgerType, setRuleLedgerType] = useState<CashTxType>("EXPENSE");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [ruleBusy, setRuleBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [pendingImport, setPendingImport] =
    useState<PendingCategoriesImport | null>(null);
  const committingRef = useRef(false);
  const [sort, setSort] = useState<SortState<"name"> | null>(null);

  const nameById = new Map((categories ?? []).map((c) => [c.id, c.name]));

  function treeForType(ledgerType: CategoryLedgerType) {
    if (!categories) return [];
    const flat = flattenCategoryTree(
      categories.filter((c) => c.ledgerType === ledgerType),
    );
    return sortBy(flat, sort, { name: (c) => c.name });
  }

  async function handleCreate(input: {
    name: string;
    parentId: number | null;
    ledgerType: CategoryLedgerType;
  }) {
    await createCategory({
      name: input.name,
      parentId: input.parentId,
      ...(input.parentId == null ? { ledgerType: input.ledgerType } : {}),
    });
    reload();
  }

  function startEdit(category: TreeRow, field: EditableField) {
    if (editBusy) return;
    setEditing({ categoryId: category.id, field });
    setDraft(
      field === "name"
        ? category.name
        : category.parentId == null
          ? ""
          : String(category.parentId),
    );
    setActionErr(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
  }

  /** Blur cancels; defer so Enter commit can set committingRef first. */
  function onEditorBlur() {
    window.setTimeout(() => {
      if (!committingRef.current) cancelEdit();
    }, 0);
  }

  async function commitEdit(category: TreeRow) {
    if (!editing || editing.categoryId !== category.id || editBusy) return;
    setActionErr(null);
    committingRef.current = true;
    setEditBusy(true);
    try {
      if (editing.field === "name") {
        const trimmed = draft.trim();
        if (!trimmed) throw new Error("Name required");
        if (trimmed !== category.name) {
          await updateCategory(category.id, { name: trimmed });
          reload();
        }
      } else {
        const parentId = draft === "" ? null : Number(draft);
        if (draft !== "" && (!Number.isInteger(parentId) || parentId! < 1)) {
          throw new Error("Invalid parent");
        }
        if (parentId !== category.parentId) {
          await updateCategory(category.id, { parentId });
          reload();
        }
      }
      cancelEdit();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      committingRef.current = false;
      setEditBusy(false);
    }
  }

  function onEditorKeyDown(e: KeyboardEvent, category: TreeRow) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit(category);
    }
  }

  function isEditing(categoryId: number, field: EditableField): boolean {
    return editing?.categoryId === categoryId && editing.field === field;
  }

  function cellClass(categoryId: number, field: EditableField, extra = ""): string {
    const parts = ["ledger-cell", "ledger-cell--editable"];
    if (isEditing(categoryId, field)) parts.push("ledger-cell--editing");
    if (extra) parts.push(extra);
    return parts.join(" ");
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    setActionErr(null);
    try {
      await deleteCategory(category.id);
      if (editing?.categoryId === category.id) cancelEdit();
      reload();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleExportCsv() {
    setActionErr(null);
    setImportMsg(null);
    setExportBusy(true);
    try {
      const blob = await exportCategoriesCsv();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "categories.csv";
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
    setPendingImport(null);
    setImportBusy(true);
    try {
      const csv = await file.text();
      const preview = await previewCategoriesImport(csv);
      if (preview.rowCount === 0) {
        setImportMsg("No categories in the CSV.");
        return;
      }
      if (preview.toCreate === 0) {
        setImportMsg(
          preview.existing === 1
            ? "All 1 category already exists."
            : `All ${preview.existing} categories already exist.`,
        );
        return;
      }
      setPendingImport({ csv, preview });
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleImportConfirm() {
    if (!pendingImport) return;
    setImportBusy(true);
    setActionErr(null);
    setImportMsg(null);
    try {
      const result = await importCategoriesCsv(pendingImport.csv);
      setImportMsg(
        `Created ${result.created}; skipped ${result.skipped}.`,
      );
      setPendingImport(null);
      reload();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleCreateRule(e: FormEvent) {
    e.preventDefault();
    setActionErr(null);
    const pattern = rulePattern.trim();
    const categoryId = Number(ruleCategoryId);
    if (!pattern) {
      setActionErr("Rule pattern required");
      return;
    }
    if (!Number.isInteger(categoryId) || categoryId < 1) {
      setActionErr("Choose a category for the rule");
      return;
    }
    setRuleBusy(true);
    try {
      await createCategoryDescriptionRule({
        pattern,
        ledgerType: ruleLedgerType,
        categoryId,
      });
      setRulePattern("");
      setRuleCategoryId("");
      reloadRules();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Create rule failed");
    } finally {
      setRuleBusy(false);
    }
  }

  async function handleDeleteRule(rule: CategoryDescriptionRule) {
    if (!window.confirm(`Delete rule “${rule.pattern}”?`)) return;
    setActionErr(null);
    try {
      await deleteCategoryDescriptionRule(rule.id);
      reloadRules();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Delete rule failed");
    }
  }

  const ruleCategoryOptions = (categories ?? []).filter(
    (c) => c.ledgerType === ruleLedgerType,
  );

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Labels for cash transactions, split by income and expense type. Double-click a name or parent to edit."
        actions={
          <AccountLedgerHeader
            exportBusy={exportBusy}
            importBusy={importBusy}
            onExport={() => void handleExportCsv()}
            onImportFile={handleImportCsvFile}
          />
        }
      />

      {actionErr && <p className="error-banner">{actionErr}</p>}
      {importMsg && <p className="success-banner">{importMsg}</p>}
      {pendingImport && (
        <section className="card form-section-gap" aria-label="Import categories">
          <p>
            Will create {pendingImport.preview.toCreate};{" "}
            {pendingImport.preview.existing} already exist.
          </p>
          <div className="form-actions-row">
            <button
              type="button"
              className="btn-primary"
              disabled={importBusy}
              onClick={() => void handleImportConfirm()}
            >
              {importBusy ? "Importing…" : "Import"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={importBusy}
              onClick={() => setPendingImport(null)}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
      <StatusBlock
        loading={loading}
        error={error}
        empty={false}
        loadingMessage="Loading categories…"
      />

      {!loading &&
        !error &&
        (categories?.length ?? 0) === 0 && (
          <p className="empty-state" role="status">
            No categories yet — use the create rows below (Income / Expense /
            Transfers sections).
          </p>
        )}

      {!loading &&
        !error &&
        SECTIONS.map(({ ledgerType, title }) => {
          const rows = treeForType(ledgerType);
          return (
            <section
              key={ledgerType}
              id={`category-section-${ledgerType}`}
              className={
                focusLedgerType === ledgerType
                  ? "card form-section-gap category-section--focus"
                  : "card form-section-gap"
              }
            >
              <h2 className="section-title">{title}</h2>
              <div className="table-wrap">
                <table className="data-table ledger-table">
                  <thead>
                    <tr>
                      <SortableTh
                        label="Name"
                        sortKey="name"
                        sort={sort}
                        onToggle={(key) =>
                          setSort((prev) => toggleSort(prev, key))
                        }
                        className="col-text"
                      />
                      <th className="col-text">Parent</th>
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <CategoryCreateRow
                      ledgerType={ledgerType}
                      parentOptions={rows}
                      onCreate={handleCreate}
                      onActionError={setActionErr}
                    />
                    {rows.map((category) => (
                      <CategoryRow
                        key={category.id}
                        category={category}
                        parentOptions={rows}
                        parentName={
                          category.parentId == null
                            ? "—"
                            : (nameById.get(category.parentId) ?? "—")
                        }
                        draft={draft}
                        editBusy={editBusy}
                        isEditing={isEditing}
                        cellClass={cellClass}
                        onStartEdit={startEdit}
                        onDraftChange={setDraft}
                        onEditorKeyDown={onEditorKeyDown}
                        onEditorBlur={onEditorBlur}
                        onDelete={handleDelete}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

      {!loading && !error && (
        <section
          className="card form-section-gap"
          aria-label="Description category rules"
        >
          <h2 className="section-title">Description rules</h2>
          <p className="muted">
            If an import description contains the pattern, suggest this category
            (rules beat ledger history). Confirming a map on import also saves
            an exact-description rule.
          </p>
          {rulesError && <p className="error-banner">{rulesError}</p>}
          {rulesLoading ? (
            <p className="muted">Loading rules…</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pattern</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(descriptionRules ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No description rules yet.
                      </td>
                    </tr>
                  ) : (
                    (descriptionRules ?? []).map((rule) => (
                      <tr key={rule.id}>
                        <td>{rule.pattern}</td>
                        <td>
                          <span className="badge">{rule.ledgerType}</span>
                        </td>
                        <td>
                          {nameById.get(rule.categoryId) ??
                            `#${rule.categoryId}`}
                        </td>
                        <td className="col-actions">
                          <button
                            type="button"
                            className="btn-danger"
                            aria-label={`Delete rule ${rule.pattern}`}
                            onClick={() => void handleDeleteRule(rule)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <form className="form-section-gap" onSubmit={(e) => void handleCreateRule(e)}>
            <div className="form-actions-row">
              <input
                className="field-control"
                placeholder="Pattern (contains)"
                value={rulePattern}
                onChange={(e) => setRulePattern(e.target.value)}
                aria-label="Rule pattern"
                disabled={ruleBusy}
              />
              <select
                className="field-control"
                value={ruleLedgerType}
                onChange={(e) => {
                  setRuleLedgerType(e.target.value as CashTxType);
                  setRuleCategoryId("");
                }}
                aria-label="Rule ledger type"
                disabled={ruleBusy}
              >
                <option value="EXPENSE">EXPENSE</option>
                <option value="INCOME">INCOME</option>
              </select>
              <select
                className="field-control"
                value={ruleCategoryId}
                onChange={(e) => setRuleCategoryId(e.target.value)}
                aria-label="Rule category"
                disabled={ruleBusy}
              >
                <option value="">Category…</option>
                {ruleCategoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="btn-primary"
                disabled={ruleBusy}
              >
                {ruleBusy ? "Adding…" : "Add rule"}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
