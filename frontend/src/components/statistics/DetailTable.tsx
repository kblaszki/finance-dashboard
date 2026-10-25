import { useEffect, useMemo, useState } from "react";
import {
  visibleCategoryTreeRows,
  type CategoryTreeStatRow,
} from "../../utils/categoryTreeStats";
import { formatMoney } from "../../utils/format";

export function DetailTable(props: {
  title: string;
  rows: CategoryTreeStatRow[];
  currency: string;
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const rowsSignature = props.rows.map((r) => r.key).join("|");

  useEffect(() => {
    setExpandedKeys(new Set());
  }, [rowsSignature]);

  const visible = useMemo(
    () => visibleCategoryTreeRows(props.rows, expandedKeys),
    [props.rows, expandedKeys],
  );

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="form-section-gap">
      <h2 className="section-title">{props.title}</h2>
      {props.rows.length === 0 ? (
        <p className="empty-state">No rows.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table stats-category-tree">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Count</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const expanded = expandedKeys.has(row.key);
                return (
                  <tr
                    key={row.key}
                    className={
                      row.isRoot ? "stats-category-tree__root" : undefined
                    }
                  >
                    <td
                      className={
                        row.isRoot
                          ? "category-root stats-category-tree__name"
                          : "stats-category-tree__name"
                      }
                      style={{
                        paddingInlineStart: `${0.5 + row.depth * 1.25}rem`,
                      }}
                    >
                      {row.hasChildren ? (
                        <button
                          type="button"
                          className="stats-category-tree__toggle"
                          aria-expanded={expanded}
                          aria-label={
                            expanded
                              ? `Collapse ${row.name}`
                              : `Expand ${row.name}`
                          }
                          onClick={() => toggleExpanded(row.key)}
                        >
                          <span aria-hidden>{expanded ? "▾" : "▸"}</span>
                        </button>
                      ) : (
                        <span
                          className="stats-category-tree__toggle-spacer"
                          aria-hidden
                        />
                      )}
                      {row.name}
                    </td>
                    <td className="num">{row.rolledCount}</td>
                    <td className="num">
                      {formatMoney(row.rolledTotal, props.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
