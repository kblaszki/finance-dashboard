import type { Category } from "../../api/categoriesApi";
import type { Tag } from "../../api/tagsApi";
import {
  EMPTY_LEDGER_FILTERS,
  isLedgerFilterActive,
  type LedgerFilterState,
} from "../../utils/listFilters";

export function LedgerFilterBar(props: {
  filters: LedgerFilterState;
  onChange: (next: LedgerFilterState) => void;
  categories: Category[];
  tags: Tag[];
}) {
  const active = isLedgerFilterActive(props.filters);
  const categoryOptions = props.categories
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const tagOptions = props.tags
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  function patch(partial: Partial<LedgerFilterState>) {
    props.onChange({ ...props.filters, ...partial });
  }

  return (
    <div className="list-filter-bar" aria-label="Ledger filters">
      <label>
        From
        <input
          type="date"
          value={props.filters.fromDate}
          onChange={(e) => patch({ fromDate: e.target.value })}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={props.filters.toDate}
          onChange={(e) => patch({ toDate: e.target.value })}
        />
      </label>
      <label>
        Type
        <select
          value={props.filters.type}
          onChange={(e) => patch({ type: e.target.value })}
        >
          <option value="">All</option>
          <option value="INCOME">INCOME</option>
          <option value="EXPENSE">EXPENSE</option>
          <option value="TRANSFER_IN">TRANSFER_IN</option>
          <option value="TRANSFER_OUT">TRANSFER_OUT</option>
        </select>
      </label>
      <label>
        Category
        <select
          value={props.filters.categoryId}
          onChange={(e) => patch({ categoryId: e.target.value })}
        >
          <option value="">All</option>
          <option value="none">Uncategorized</option>
          {categoryOptions.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tag
        <select
          value={props.filters.tagId}
          onChange={(e) => patch({ tagId: e.target.value })}
        >
          <option value="">All</option>
          {tagOptions.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Description
        <input
          type="search"
          value={props.filters.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Search…"
        />
      </label>
      {active && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => props.onChange({ ...EMPTY_LEDGER_FILTERS })}
        >
          Clear
        </button>
      )}
    </div>
  );
}
