import { Link } from "react-router-dom";
import { useAuth } from "../state/auth";

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="page-stack">
      <h1 className="page-title">Welcome</h1>
      <section className="card form-section-gap">
        <p>
          Signed in as <strong>{user?.username ?? user?.email}</strong>.
        </p>
        <p className="muted">
          Account management is available in settings. More features will be added over time.
        </p>
        <p>
          <Link to="/settings" className="btn-primary">
            Account settings
          </Link>
        </p>
      </section>
    </div>
  );
}
