export function PageHeader(props: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{props.title}</h1>
        {props.subtitle && <p className="page-subtitle muted">{props.subtitle}</p>}
      </div>
      {props.actions && <div className="page-header-actions">{props.actions}</div>}
    </header>
  );
}
