export function currentUtcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1 + delta;
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return d.toISOString().slice(0, 7);
}

export function utcMonthFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return currentUtcMonth();
  return d.toISOString().slice(0, 7);
}

export type ListViewMode = "month" | "all";

export function MonthPager(props: {
  mode: ListViewMode;
  month: string;
  onModeChange: (mode: ListViewMode) => void;
  onMonthChange: (month: string) => void;
  hasMore?: boolean;
  loadMoreBusy?: boolean;
  onLoadMore?: () => void;
}) {
  return (
    <div className="month-pager form-actions-row">
      <div className="stats-segmented" role="group" aria-label="List range">
        <button
          type="button"
          className={
            props.mode === "month"
              ? "stats-segmented__btn stats-segmented__btn--active"
              : "stats-segmented__btn"
          }
          onClick={() => props.onModeChange("month")}
        >
          Month
        </button>
        <button
          type="button"
          className={
            props.mode === "all"
              ? "stats-segmented__btn stats-segmented__btn--active"
              : "stats-segmented__btn"
          }
          onClick={() => props.onModeChange("all")}
        >
          All time
        </button>
      </div>
      {props.mode === "month" ? (
        <>
          <button
            type="button"
            className="btn-secondary"
            aria-label="Previous month"
            onClick={() => props.onMonthChange(shiftMonth(props.month, -1))}
          >
            ‹
          </button>
          <input
            type="month"
            className="field-control field-control--compact"
            value={props.month}
            onChange={(e) => props.onMonthChange(e.target.value)}
            aria-label="Month"
          />
          <button
            type="button"
            className="btn-secondary"
            aria-label="Next month"
            onClick={() => props.onMonthChange(shiftMonth(props.month, 1))}
          >
            ›
          </button>
        </>
      ) : (
        props.hasMore && (
          <button
            type="button"
            className="btn-secondary"
            disabled={props.loadMoreBusy}
            onClick={() => props.onLoadMore?.()}
          >
            {props.loadMoreBusy ? "Loading…" : "Load more"}
          </button>
        )
      )}
    </div>
  );
}
