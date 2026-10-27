export function GoalsEmptyCard() {
  return (
    <article className="card dash-panel">
      <div className="chart-card-head">
        <div>
          <h2 className="section-title">Goals in motion</h2>
          <p className="muted chart-card-subtitle">
            Track savings targets alongside cashflow.
          </p>
        </div>
      </div>
      <p className="empty-state" role="status">
        Goals aren’t available yet. This panel is a placeholder until a goals
        feature ships.
      </p>
    </article>
  );
}
