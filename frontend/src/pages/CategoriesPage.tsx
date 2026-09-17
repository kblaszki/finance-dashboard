import { type FormEvent, useCallback, useMemo, useState } from "react";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  flattenCategoryTree,
  updateCategory,
  type Category,
} from "../api/categoriesApi";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";

export function CategoriesPage() {
  const loadCategories = useCallback(() => fetchCategories(), []);
  const { data: categories, error, loading, reload } = useAsyncData(loadCategories);

  const treeRows = useMemo(
    () => (categories ? flattenCategoryTree(categories) : []),
    [categories],
  );

  const [showCreate, setShowCreate] = useState(false);
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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    setCreateBusy(true);
    try {
      await createCategory({
        name,
        parentId: parentId === "" ? null : Number(parentId),
      });
      setName("");
      setParentId("");
      setShowCreate(false);
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
        subtitle="Nested labels for cash transactions. Defaults are created on register."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Hide form" : "Add category"}
          </button>
        }
      />

      {showCreate && (
        <section className="card form-section-gap">
          <h2 className="section-title">Add category</h2>
          <form className="auth-form" onSubmit={handleCreate}>
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
              <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">— Root —</option>
                {treeRows.map((cat) => (
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
        </section>
      )}

      <section className="card form-section-gap">
        <h2 className="section-title">Your categories</h2>
        {actionErr && <p className="error-banner">{actionErr}</p>}
        <StatusBlock
          loading={loading}
          error={error}
          empty={!loading && !error && (categories?.length ?? 0) === 0}
          loadingMessage="Loading categories…"
          emptyMessage="No categories yet."
        />
        {!loading && categories && categories.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {treeRows.map((category) => (
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
                              {treeRows
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
                          style={{ paddingInlineStart: `${category.depth * 1.25}rem` }}
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
    </>
  );
}
