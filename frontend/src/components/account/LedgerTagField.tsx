import type { KeyboardEvent } from "react";
import type { Tag } from "../../api/tagsApi";

export function LedgerTagField(props: {
  tags: Tag[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: KeyboardEvent) => void;
  onBlur?: () => void;
  "aria-label"?: string;
}) {
  const selected = new Set(props.selectedIds);
  const selectedTags = props.tags
    .filter((t) => selected.has(t.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const available = props.tags
    .filter((t) => !selected.has(t.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  function add(value: string) {
    if (!value) return;
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1 || selected.has(id)) return;
    props.onChange([...props.selectedIds, id].sort((a, b) => a - b));
  }

  function remove(id: number) {
    props.onChange(props.selectedIds.filter((x) => x !== id));
  }

  return (
    <div className="ledger-tags-field">
      {selectedTags.length > 0 && (
        <span className="tag-list">
          {selectedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="badge badge--removable"
              disabled={props.disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => remove(tag.id)}
              aria-label={`Remove ${tag.name}`}
            >
              {tag.name}
              <span aria-hidden="true"> ×</span>
            </button>
          ))}
        </span>
      )}
      <select
        className="ledger-cell-input"
        value=""
        disabled={props.disabled || available.length === 0}
        autoFocus={props.autoFocus}
        onChange={(e) => {
          add(e.target.value);
          e.currentTarget.value = "";
        }}
        onKeyDown={props.onKeyDown}
        onBlur={props.onBlur}
        aria-label={props["aria-label"] ?? "Tags"}
      >
        <option value="">—</option>
        {available.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
    </div>
  );
}
