import { Link } from "react-router-dom";
import { useAuth } from "../state/auth";

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="home-folio">
      <p className="home-folio-eyebrow">Home</p>
      <h1 className="page-title">Open the folio</h1>
      <p className="muted home-folio-lead">
        Signed in as <strong>{user?.username ?? user?.email}</strong>. Account
        management is available in settings. More features will be added over
        time.
      </p>
      <div className="home-folio-rule" aria-hidden />
      <Link to="/settings" className="btn-primary">
        Account settings
      </Link>
    </div>
  );
}
