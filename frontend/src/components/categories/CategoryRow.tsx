import { type KeyboardEvent } from "react";
import type { Category } from "../../api/categoriesApi";
import type { CategoryTreeRow } from "./CategoryCreateRow";

export type CategoryEditableField = "name" | "parentId";

export function CategoryRow(props: {
  category: CategoryTreeRow;
  parentOptions: CategoryTreeRow[];
  parentName: string;
  draft: string;
  editBusy: boolean;
  isEditing: (categoryId: number, field: CategoryEditableField) => boolean;
  cellClass: (categoryId: number, field: CategoryEditableField, extra?: string) => string;
  onStartEdit: (category: CategoryTreeRow, field: CategoryEditableField) => void;
  onDraftChange: (value: string) => void;
  onEditorKeyDown: (e: KeyboardEvent, category: CategoryTreeRow) => void;
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

