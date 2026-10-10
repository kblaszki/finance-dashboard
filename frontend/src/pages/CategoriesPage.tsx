import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  flattenCategoryTree,
  updateCategory,
  type Category,
  type CategoryLedgerType,
} from "../api/categoriesApi";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";

const SECTIONS: Array<{ ledgerType: CategoryLedgerType; title: string }> = [
  { ledgerType: "INCOME", title: "Income" },
  { ledgerType: "EXPENSE", title: "Expense" },
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
      nameRef.current?.focus();
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
      <td>
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
        className={props.cellClass(category.id, "name")}
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
        className={props.cellClass(category.id, "parentId")}
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
      <td>
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
  const loadCategories = useCallback(() => fetchCategories(), []);
  const { data: categories, error, loading, reload } = useAsyncData(loadCategories);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draft, setDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const committingRef = useRef(false);

  const nameById = new Map((categories ?? []).map((c) => [c.id, c.name]));

  function treeForType(ledgerType: CategoryLedgerType) {
    if (!categories) return [];
    return flattenCategoryTree(categories.filter((c) => c.ledgerType === ledgerType));
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

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Labels for cash transactions, split by income and expense type. Double-click a name or parent to edit."
      />

      {actionErr && <p className="error-banner">{actionErr}</p>}
      <StatusBlock
        loading={loading}
        error={error}
        empty={false}
        loadingMessage="Loading categories…"
      />

      {!loading &&
        !error &&
        SECTIONS.map(({ ledgerType, title }) => {
          const rows = treeForType(ledgerType);
          return (
            <section key={ledgerType} className="card form-section-gap">
              <h2 className="section-title">{title}</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Parent</th>
                      <th>Actions</th>
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
    </>
  );
}
