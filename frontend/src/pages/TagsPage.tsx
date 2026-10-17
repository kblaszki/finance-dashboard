import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createTag,
  deleteTag,
  fetchTags,
  updateTag,
  type Tag,
} from "../api/tagsApi";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";

type EditingState = { tagId: number };

function TagCreateRow(props: {
  onCreate: (name: string) => Promise<void>;
  onActionError: (message: string | null) => void;
}) {
  const [name, setName] = useState("");
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
      await props.onCreate(trimmed);
      setName("");
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
          aria-label="New tag name"
          placeholder="Name"
        />
      </td>
      <td className="col-actions">
        <form className="form-actions-row" onSubmit={onFormSubmit}>
          <button
            type="submit"
            className="btn-primary"
            disabled={createBusy}
            aria-label="Add tag"
          >
            {createBusy ? "…" : "Add"}
          </button>
        </form>
      </td>
    </tr>
  );
}

function TagRow(props: {
  tag: Tag;
  draft: string;
  editBusy: boolean;
  isEditing: boolean;
  cellClass: string;
  onStartEdit: (tag: Tag) => void;
  onDraftChange: (value: string) => void;
  onEditorKeyDown: (e: KeyboardEvent, tag: Tag) => void;
  onEditorBlur: () => void;
  onDelete: (tag: Tag) => void;
}) {
  const { tag } = props;

  return (
    <tr>
      <td className={props.cellClass} onDoubleClick={() => props.onStartEdit(tag)}>
        {props.isEditing ? (
          <input
            type="text"
            className="ledger-cell-input"
            value={props.draft}
            disabled={props.editBusy}
            autoFocus
            onChange={(e) => props.onDraftChange(e.target.value)}
            onKeyDown={(e) => props.onEditorKeyDown(e, tag)}
            onBlur={props.onEditorBlur}
            aria-label="Edit name"
          />
        ) : (
          tag.name
        )}
      </td>
      <td className="col-actions">
        <div className="form-actions-row">
          <button
            type="button"
            className="btn-danger"
            aria-label={`Delete ${tag.name}`}
            onClick={() => props.onDelete(tag)}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export function TagsPage() {
  const loadTags = useCallback(() => fetchTags(), []);
  const { data: tags, error, loading, reload } = useAsyncData(loadTags);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draft, setDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const committingRef = useRef(false);

  async function handleCreate(name: string) {
    await createTag({ name });
    reload();
  }

  function startEdit(tag: Tag) {
    if (editBusy) return;
    setEditing({ tagId: tag.id });
    setDraft(tag.name);
    setActionErr(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
  }

  function onEditorBlur() {
    window.setTimeout(() => {
      if (!committingRef.current) cancelEdit();
    }, 0);
  }

  async function commitEdit(tag: Tag) {
    if (!editing || editing.tagId !== tag.id || editBusy) return;
    setActionErr(null);
    committingRef.current = true;
    setEditBusy(true);
    try {
      const trimmed = draft.trim();
      if (!trimmed) throw new Error("Name required");
      if (trimmed !== tag.name) {
        await updateTag(tag.id, { name: trimmed });
        reload();
      }
      cancelEdit();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      committingRef.current = false;
      setEditBusy(false);
    }
  }

  function onEditorKeyDown(e: KeyboardEvent, tag: Tag) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit(tag);
    }
  }

  async function handleDelete(tag: Tag) {
    if (!window.confirm(`Delete tag "${tag.name}"?`)) return;
    setActionErr(null);
    try {
      await deleteTag(tag.id);
      if (editing?.tagId === tag.id) cancelEdit();
      reload();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const rows = [...(tags ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Tags"
        subtitle="Optional labels for income and expense transactions. Double-click a name to rename."
      />

      {actionErr && <p className="error-banner">{actionErr}</p>}
      <StatusBlock
        loading={loading}
        error={error}
        empty={false}
        loadingMessage="Loading tags…"
      />

      {!loading && !error && (
        <section className="card form-section-gap">
          <div className="table-wrap">
            <table className="data-table data-table--tags">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <TagCreateRow onCreate={handleCreate} onActionError={setActionErr} />
                {rows.map((tag) => {
                  const isEditing = editing?.tagId === tag.id;
                  const cellClass = [
                    "ledger-cell",
                    "ledger-cell--editable",
                    isEditing ? "ledger-cell--editing" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <TagRow
                      key={tag.id}
                      tag={tag}
                      draft={draft}
                      editBusy={editBusy}
                      isEditing={!!isEditing}
                      cellClass={cellClass}
                      onStartEdit={startEdit}
                      onDraftChange={setDraft}
                      onEditorKeyDown={onEditorKeyDown}
                      onEditorBlur={onEditorBlur}
                      onDelete={handleDelete}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
