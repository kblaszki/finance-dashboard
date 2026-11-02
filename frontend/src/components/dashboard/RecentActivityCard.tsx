import { Link } from "react-router-dom";
import type { RecentCashActivityItem } from "../../api/statisticsApi";
import { formatOccurredAt } from "../account/occurredAt";
import { formatMoney } from "../../utils/format";

export function RecentActivityCard(props: {
  items: RecentCashActivityItem[];
  uncategorizedCount: number;
}) {
  const { items, uncategorizedCount } = props;

  return (
    <article className="card dash-panel dash-activity">
      <div className="chart-card-head">
        <div>
          <h2 className="section-title">Recent cash activity</h2>
          <p className="muted chart-card-subtitle">
            Latest income and expense across accounts
            {uncategorizedCount > 0
              ? ` · ${uncategorizedCount} uncategorized`
              : ""}
          </p>
        </div>
        <Link to="/cashflow" className="btn-secondary">
          Open cashflow
        </Link>
      </div>
      {uncategorizedCount > 0 ? (
        <p className="muted dash-attention-note" role="status">
          {uncategorizedCount} cash{" "}
          {uncategorizedCount === 1 ? "transaction needs" : "transactions need"}{" "}
          a category — open an account ledger to label them.
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="empty-state" role="status">
          No cash activity yet.{" "}
          <Link to="/accounts">Open an account ledger</Link> to record income
          or spending.
        </p>
      ) : (
        <ul className="dash-activity-list">
          {items.map((row) => {
            const signed =
              row.type === "EXPENSE" ? -Math.abs(row.amount) : row.amount;
            return (
              <li key={row.id} className="dash-activity-item">
                <span className="dash-activity-icon" aria-hidden>
                  {row.type === "INCOME" ? "+" : "−"}
                </span>
                <span className="dash-activity-copy">
                  <span className="dash-activity-title">
                    {row.accountName}
                    {row.categoryName
                      ? ` · ${row.categoryName}`
                      : " · Uncategorized"}
                  </span>
                  <small className="muted">
                    {formatOccurredAt(row.occurredAt)}
                    {row.description ? ` · ${row.description}` : ""}
                  </small>
                </span>
                <b
                  className={
                    row.type === "INCOME"
                      ? "dash-activity-amount positive"
                      : "dash-activity-amount negative"
                  }
                >
                  {formatMoney(signed, row.currency)}
                </b>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
