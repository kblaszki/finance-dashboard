/**
 * Shared loading / error / empty rendering. Renders nothing when all clear,
 * so pages can do: `<StatusBlock … /> || <Content />` style branching.
 */
export function StatusBlock(props: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
}) {
  if (props.loading) {
    return <p className="loading-state">{props.loadingMessage ?? "Loading…"}</p>;
  }
  if (props.error) {
    return <p className="error-banner">{props.error}</p>;
  }
  if (props.empty) {
    return <p className="empty-state">{props.emptyMessage ?? "Nothing here yet."}</p>;
  }
  return null;
}
