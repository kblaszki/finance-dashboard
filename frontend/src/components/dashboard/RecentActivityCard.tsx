import { Link } from "react-router-dom";
import type { Account } from "../../api/accountsApi";
import type { CashTransfer } from "../../api/transfersApi";
import { formatOccurredAt } from "../account/occurredAt";
import { formatMoney } from "../../utils/format";

export function RecentActivityCard(props: {
  transfers: CashTransfer[];
  accounts: Account[];
}) {
  const nameById = new Map(props.accounts.map((a) => [a.id, a.name]));

  return (
    <article className="card dash-panel dash-activity">
      <div className="chart-card-head">
        <div>
          <h2 className="section-title">Recent activity</h2>
          <p className="muted chart-card-subtitle">Latest internal transfers</p>
        </div>
        <Link to="/transfers" className="btn-secondary">
          See all
        </Link>
      </div>
      {props.transfers.length === 0 ? (
        <p className="empty-state" role="status">
          No transfers yet.{" "}
          <Link to="/transfers">Record a transfer</Link> or{" "}
          <Link to="/accounts">open an account ledger</Link>.
        </p>
      ) : (
        <ul className="dash-activity-list">
          {props.transfers.map((t) => {
            const fromName = nameById.get(t.fromAccountId) ?? `Account ${t.fromAccountId}`;
            const toName = nameById.get(t.toAccountId) ?? `Account ${t.toAccountId}`;
            return (
              <li key={t.id} className="dash-activity-item">
                <span className="dash-activity-icon" aria-hidden>
                  ↔
                </span>
                <span className="dash-activity-copy">
                  <span className="dash-activity-title">
                    {fromName} → {toName}
                  </span>
                  <small className="muted">
                    {formatOccurredAt(t.occurredAt)}
                    {t.description ? ` · ${t.description}` : " · Transfer"}
                  </small>
                </span>
                <b className="dash-activity-amount">
                  −{formatMoney(t.amountFrom, t.fromCurrency)}
                </b>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
