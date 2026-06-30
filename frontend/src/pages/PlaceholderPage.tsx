type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage(props: PlaceholderPageProps) {
  return (
    <div className="page-stack">
      <h1 className="page-title">{props.title}</h1>
      <p className="muted">{props.description}</p>
    </div>
  );
}
