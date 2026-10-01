import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Keeps a shell mounted when a nested route throws. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-banner" role="alert">
        <p>Something went wrong.</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <Link className="btn-secondary" to="/dashboard">
          Dashboard
        </Link>
      </div>
    );
  }
}
