import type { CSSProperties } from "react";
import { formatMoney } from "../../utils/format";
import type { RollupRow } from "../../utils/statisticsRollup";
import { CHART_COLORS } from "./chartColors";

export function CategoryBars(props: {
  rows: RollupRow[];
  currency: string;
  tone?: "positive" | "negative" | "neutral";
  emptyLabel: string;
  maxRows?: number;
}) {
  const {
    rows,
    currency,
    tone = "neutral",
    emptyLabel,
    maxRows,
  } = props;
  const visible = maxRows != null ? rows.slice(0, maxRows) : rows;
  const maxTotal = Math.max(...visible.map((r) => Math.abs(r.total)), 0);
  const toneClass = tone === "neutral" ? "" : `stat-row-value ${tone}`;

  if (visible.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <ul className="category-bars">
      {visible.map((row, index) => {
        const pct =
          maxTotal > 0 ? (Math.abs(row.total) / maxTotal) * 100 : 0;
        return (
          <li key={row.key} className="category-bar-row">
            <div className="category-bar-meta">
              <span className="category-bar-name">
                <span
                  className="legend-dot"
                  style={
                    {
                      "--swatch":
                        CHART_COLORS[index % CHART_COLORS.length],
                    } as CSSProperties
                  }
                  aria-hidden
                />
                {row.name}
                <span className="muted">
                  {" "}
                  · {row.count} {row.count === 1 ? "tx" : "txs"}
                </span>
              </span>
              <span className={`category-bar-value ${toneClass}`.trim()}>
                {formatMoney(row.total, currency)}
              </span>
            </div>
            <div
              className="category-bar-track"
              role="presentation"
              aria-hidden
            >
              <div
                className="category-bar-fill"
                style={
                  {
                    width: `${pct}%`,
                    "--swatch":
                      CHART_COLORS[index % CHART_COLORS.length],
                  } as CSSProperties
                }
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
