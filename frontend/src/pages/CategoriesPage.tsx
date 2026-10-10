import { type FormEvent, useCallback, useState } from "react";
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

export function CategoriesPage() {
  const loadCategories = useCallback(() => fetchCategories(), []);
  const { data: categories, error, loading, reload } = useAsyncData(loadCategories);

  const [creatingType, setCreatingType] = useState<CategoryLedgerType | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

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

  function resetCreateForm() {
    setName("");
    setParentId("");
    setCreateErr(null);
    setCreatingType(null);
  }

  async function handleCreate(e: FormEvent, ledgerType: CategoryLedgerType) {
    e.preventDefault();
    setCreateErr(null);
    setCreateBusy(true);
    try {
      const parent = parentId === "" ? null : Number(parentId);
      await createCategory({
        name,
        parentId: parent,
        ...(parent == null ? { ledgerType } : {}),
      });
      resetCreateForm();
      reload();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditParentId(category.parentId == null ? "" : String(category.parentId));
    setEditErr(null);
    setActionErr(null);
    setCreatingType(null);
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

      {!loading && !error &&
        SECTIONS.map(({ ledgerType, title }) => {
          const rows = treeForType(ledgerType);
          const showForm = creatingType === ledgerType;
          return (
            <section key={ledgerType} className="card form-section-gap">
              <div className="form-actions-row" style={{ justifyContent: "space-between" }}>
                <h2 className="section-title">{title}</h2>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (showForm) {
                      resetCreateForm();
                      return;
                    }
                    setEditingId(null);
                    setCreateErr(null);
                    setName("");
                    setParentId("");
                    setCreatingType(ledgerType);
                  }}
                >
                  {showForm ? "Hide form" : `Add ${title.toLowerCase()} category`}
                </button>
              </div>

              {showForm && (
                <form
                  className="auth-form"
                  onSubmit={(e) => void handleCreate(e, ledgerType)}
                >
                  <label>
                    Name
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label>
                    Parent (optional)
                    <select
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                    >
                      <option value="">— Root —</option>
                      {rows.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {"\u00A0".repeat(cat.depth * 2)}
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {createErr && <p className="auth-error">{createErr}</p>}
                  <button type="submit" className="btn-primary" disabled={createBusy}>
                    {createBusy ? "Creating…" : "Create category"}
                  </button>
                </form>
              )}

              {rows.length === 0 ? (
                <p className="empty-state">No {title.toLowerCase()} categories yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
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
              )}
            </section>
          );
        })}
    </>
  );
}
