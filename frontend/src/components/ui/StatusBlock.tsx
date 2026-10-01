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
    return (
      <p className="loading-state" role="status" aria-live="polite">
        {props.loadingMessage ?? "Loading…"}
      </p>
    );
  }
  if (props.error) {
    return (
      <p className="error-banner" role="alert">
        {props.error}
      </p>
    );
  }
  if (props.empty) {
    return (
      <p className="empty-state" role="status">
        {props.emptyMessage ?? "Nothing here yet."}
      </p>
    );
  }
  return null;
}
