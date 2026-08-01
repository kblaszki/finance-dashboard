export function KpiCard(props: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  sub?: React.ReactNode;
}) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{props.label}</span>
      <span className={`kpi-value${props.tone ? ` ${props.tone}` : ""}`}>
        {props.value}
      </span>
      {props.sub != null && <span className="kpi-sub muted">{props.sub}</span>}
    </div>
  );
}
