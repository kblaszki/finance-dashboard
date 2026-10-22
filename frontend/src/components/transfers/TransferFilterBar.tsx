import type { Account } from "../../api/accountsApi";
import type { Category } from "../../api/categoriesApi";
import {
  EMPTY_TRANSFER_FILTERS,
  isTransferFilterActive,
  type TransferFilterState,
} from "../../utils/listFilters";

export function TransferFilterBar(props: {
  filters: TransferFilterState;
  onChange: (next: TransferFilterState) => void;
  accounts: Account[];
  categories: Category[];
}) {
  const active = isTransferFilterActive(props.filters);

  function patch(partial: Partial<TransferFilterState>) {
    props.onChange({ ...props.filters, ...partial });
  }

  return (
    <div className="list-filter-bar" aria-label="Transfer filters">
      <label>
        From date
        <input
          type="date"
          className="field-control"
          value={props.filters.fromDate}
          onChange={(e) => patch({ fromDate: e.target.value })}
        />
      </label>
      <label>
        To date
        <input
          type="date"
          className="field-control"
          value={props.filters.toDate}
          onChange={(e) => patch({ toDate: e.target.value })}
        />
      </label>
      <label>
        From account
        <select
          className="field-control"
          value={props.filters.fromAccountId}
          onChange={(e) => patch({ fromAccountId: e.target.value })}
        >
          <option value="">All</option>
          {props.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        To account
        <select
          className="field-control"
          value={props.filters.toAccountId}
          onChange={(e) => patch({ toAccountId: e.target.value })}
        >
          <option value="">All</option>
          {props.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Category
        <select
          className="field-control"
          value={props.filters.categoryId}
          onChange={(e) => patch({ categoryId: e.target.value })}
        >
          <option value="">All</option>
          <option value="none">Uncategorized</option>
          {props.categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Description
        <input
          type="search"
          className="field-control"
          value={props.filters.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Search…"
        />
      </label>
      {active && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => props.onChange({ ...EMPTY_TRANSFER_FILTERS })}
        >
          Clear
        </button>
      )}
    </div>
  );
}
