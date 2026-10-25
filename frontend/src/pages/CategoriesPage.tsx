import {
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
import { fetchCategoryDescriptionRules } from "../api/categoryDescriptionRulesApi";
import {
  CategoryCreateRow,
  type CategoryTreeRow,
} from "../components/categories/CategoryCreateRow";
import {
  CategoryRow,
  type CategoryEditableField,
} from "../components/categories/CategoryRow";
import { DescriptionRulesPanel } from "../components/categories/DescriptionRulesPanel";
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

type TreeRow = CategoryTreeRow;
type EditableField = CategoryEditableField;
type EditingState = { categoryId: number; field: EditableField };

export function CategoriesPage() {
  const [searchParams] = useSearchParams();
  const focusLedgerType = parseLedgerTypeParam(searchParams.get("ledgerType"));

  useEffect(() => {
    if (!focusLedgerType) return;
    let cancelled = false;
    const el = document.getElementById(`category-section-${focusLedgerType}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    const input = el?.querySelector<HTMLInputElement>(
      'input[aria-label="New category name"]',
    );
    const id = window.setTimeout(() => {
      if (cancelled) return;
      input?.focus({ preventScroll: true });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
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
  const [draft, setDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [pendingImport, setPendingImport] =
    useState<PendingCategoriesImport | null>(null);
  const committingRef = useRef(false);
  const blurTimeoutRef = useRef<number | null>(null);
  const [sort, setSort] = useState<SortState<"name"> | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current != null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

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
    if (blurTimeoutRef.current != null) {
      window.clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = window.setTimeout(() => {
      blurTimeoutRef.current = null;
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
        <DescriptionRulesPanel
          rules={descriptionRules}
          rulesLoading={rulesLoading}
          rulesError={rulesError}
          categories={categories ?? []}
          nameById={nameById}
          onReload={reloadRules}
          onActionError={setActionErr}
        />
      )}
    </>
  );
}
