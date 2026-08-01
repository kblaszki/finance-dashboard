import { Link } from "react-router-dom";
import { useAuth } from "../state/auth";

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="home-folio">
      <p className="home-folio-eyebrow">Home</p>
      <h1 className="page-title">Open the folio</h1>
      <p className="muted home-folio-lead">
        Signed in as <strong>{user?.username ?? user?.email}</strong>. Manage
        bank accounts or open settings. More features will be added over time.
      </p>
      <div className="home-folio-rule" aria-hidden />
      <div className="home-action-grid">
        <Link to="/accounts" className="card home-action-card">
          <h2 className="section-title">Accounts</h2>
          <p className="muted">
            Bank accounts — create, edit, and track opening balances.
          </p>
        </Link>
        <Link to="/settings" className="card home-action-card">
          <h2 className="section-title">Settings</h2>
          <p className="muted">
            Profile, email, password, and appearance preferences.
          </p>
        </Link>
      </div>
    </div>
  );
}
