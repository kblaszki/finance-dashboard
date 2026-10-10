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

export function CategoriesPage() {
  const loadCategories = useCallback(() => fetchCategories(), []);
  const { data: categories, error, loading, reload } = useAsyncData(loadCategories);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

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

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditParentId(category.parentId == null ? "" : String(category.parentId));
    setEditErr(null);
    setActionErr(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditErr(null);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (editingId == null) return;
    setEditErr(null);
    setEditBusy(true);
    try {
      await updateCategory(editingId, {
        name: editName,
        parentId: editParentId === "" ? null : Number(editParentId),
      });
      setEditingId(null);
      reload();
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditBusy(false);
    }
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    setActionErr(null);
    try {
      await deleteCategory(category.id);
      if (editingId === category.id) setEditingId(null);
      reload();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Labels for cash transactions, split by income and expense type."
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
                      <tr key={category.id}>
                        <td>
                          {editingId === category.id ? (
                            <form
                              className="auth-form auth-form--compact"
                              onSubmit={handleSaveEdit}
                            >
                              <label>
                                Name
                                <input
                                  type="text"
                                  required
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                />
                              </label>
                              <label>
                                Parent
                                <select
                                  value={editParentId}
                                  onChange={(e) => setEditParentId(e.target.value)}
                                >
                                  <option value="">— Root —</option>
                                  {rows
                                    .filter((c) => c.id !== category.id)
                                    .map((cat) => (
                                      <option key={cat.id} value={cat.id}>
                                        {"\u00A0".repeat(cat.depth * 2)}
                                        {cat.name}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              {editErr && <p className="auth-error">{editErr}</p>}
                              <div className="form-actions-row">
                                <button
                                  type="submit"
                                  className="btn-primary"
                                  disabled={editBusy}
                                >
                                  {editBusy ? "Saving…" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={cancelEdit}
                                  disabled={editBusy}
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <span
                              className={
                                category.depth === 0 ? "category-root" : undefined
                              }
                              style={{
                                paddingInlineStart: `${category.depth * 1.25}rem`,
                              }}
                            >
                              {category.name}
                            </span>
                          )}
                        </td>
                        <td>
                          {editingId === category.id
                            ? null
                            : category.parentId == null
                              ? "—"
                              : (categories?.find((c) => c.id === category.parentId)
                                  ?.name ?? "—")}
                        </td>
                        <td>
                          {editingId !== category.id && (
                            <div className="form-actions-row">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => startEdit(category)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-danger"
                                aria-label={`Delete ${category.name}`}
                                onClick={() => void handleDelete(category)}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
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
