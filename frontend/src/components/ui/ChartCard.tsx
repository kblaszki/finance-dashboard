export function ChartCard(props: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Compact height for donuts / small charts (avoids forced tall min-height). */
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  const sizeClass =
    props.size === "sm" ? "chart-container chart-container--sm" : "chart-container";
  return (
    <section className="card chart-card">
      <div className="chart-card-head">
        <div>
          <h2 className="section-title">{props.title}</h2>
          {props.subtitle && (
            <p className="muted chart-card-subtitle">{props.subtitle}</p>
          )}
        </div>
        {props.actions && (
          <div className="chart-card-actions">{props.actions}</div>
        )}
      </div>
      <div className={sizeClass}>{props.children}</div>
    </section>
  );
}
