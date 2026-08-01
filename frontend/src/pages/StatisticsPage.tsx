import { useCallback, useState } from "react";
import {
  fetchCategoryBreakdown,
  type CategoryBreakdownRow,
} from "../api/statisticsApi";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatMoney } from "../utils/format";

function currentUtcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function StatisticsPage() {
  const [month, setMonth] = useState(currentUtcMonth);

  const loadBreakdown = useCallback(
    () => fetchCategoryBreakdown(month),
    [month],
  );
  const { data, error, loading } = useAsyncData(loadBreakdown);

  return (
    <div className="page-stack">
      <h1 className="page-title">Statistics</h1>
      <p className="muted">
        Income and expense totals by category for a calendar month (UTC). Amounts
        are not converted across currencies.
      </p>

      <section className="card form-section-gap">
        <label>
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
          />
        </label>
      </section>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error-banner">{error}</p>}

      {!loading && !error && data && (
        <div className="two-col-grid">
          <BreakdownSection title="Income" rows={data.income} tone="positive" />
          <BreakdownSection title="Expense" rows={data.expense} tone="negative" />
        </div>
      )}
    </div>
  );
}

function BreakdownSection({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: CategoryBreakdownRow[];
  tone: "positive" | "negative";
}) {
  return (
    <section className="card form-section-gap">
      <h2 className="section-title">{title}</h2>
      {rows.length === 0 ? (
        <p className="empty-state">No {title.toLowerCase()} in this month.</p>
      ) : (
        <ul className="category-breakdown-list">
          {rows.map((row) => (
            <li key={`${row.categoryId ?? "null"}-${row.currency}-${row.categoryName}`}>
              <span>
                {row.categoryName}
                <span className="muted">
                  {" "}
                  · {row.currency} · {row.count}{" "}
                  {row.count === 1 ? "tx" : "txs"}
                </span>
              </span>
              <span className={`stat-row-value ${tone}`}>
                {formatMoney(row.total, row.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
