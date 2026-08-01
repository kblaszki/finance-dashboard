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
      <div className="form-actions-row">
        <Link to="/accounts" className="btn-primary">
          Accounts
        </Link>
        <Link to="/settings" className="btn-secondary">
          Account settings
        </Link>
      </div>
    </div>
  );
}
