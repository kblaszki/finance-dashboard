import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAuthConfig } from "../api/authApi";
import { useAuth } from "../state/auth";

export function LoginPage() {
  const { login } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allowRegister, setAllowRegister] = useState<boolean | null>(null);

  useEffect(() => {
    void fetchAuthConfig()
      .then((cfg) => setAllowRegister(cfg.allowRegister))
      .catch(() => setAllowRegister(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(loginId, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="page-title">Log in</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email or username
            <input
              type="text"
              autoComplete="username"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        {allowRegister === true && (
          <p className="auth-switch">
            Don&apos;t have an account? <Link to="/register">Sign up</Link>
          </p>
        )}
      </div>
    </div>
  );
}
