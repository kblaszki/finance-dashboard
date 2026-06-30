import { Link } from "react-router-dom";

export function PasswordResetPage() {
  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="page-title">Reset password</h1>
        <p className="muted">
          Self-service password reset is not available yet. Contact your administrator or create a
          new account if registration is open.
        </p>
        <p className="auth-switch">
          <Link to="/login">Back to log in</Link>
        </p>
      </div>
    </div>
  );
}
