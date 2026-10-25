import type { TagBreakdownRow } from "../../api/statisticsApi";
import { formatMoney } from "../../utils/format";

export function TagDetailTable(props: {
  title: string;
  rows: TagBreakdownRow[];
  untaggedTotal: number;
  untaggedCount: number;
  currency: string;
}) {
  const hasUntagged = props.untaggedTotal > 0 || props.untaggedCount > 0;
  const empty = props.rows.length === 0 && !hasUntagged;
  return (
    <section className="form-section-gap">
      <h2 className="section-title">{props.title}</h2>
      {empty ? (
        <p className="empty-state">No rows.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tag</th>
                <th className="num">Count</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => (
                <tr key={row.tagId}>
                  <td>{row.tagName}</td>
                  <td className="num">{row.count}</td>
                  <td className="num">
                    {formatMoney(row.total, props.currency)}
                  </td>
                </tr>
              ))}
              {hasUntagged && (
                <tr>
                  <td>Untagged</td>
                  <td className="num">{props.untaggedCount}</td>
                  <td className="num">
                    {formatMoney(props.untaggedTotal, props.currency)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
