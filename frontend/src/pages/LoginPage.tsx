import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAuthConfig } from "../api/authApi";
import { useAuth } from "../state/auth";

export function LoginPage() {
  const { login } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <>
      <p className="auth-swap-brand">Finance Dashboard</p>
      <h1 className="auth-swap-title">Log in</h1>
      <form className="auth-swap-fields" onSubmit={handleSubmit}>
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
          <span className="auth-swap-password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-swap-password__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="btn-primary auth-swap-submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      {allowRegister === true && (
        <p className="auth-swap-switch">
          Don&apos;t have an account? <Link to="/register">Sign up</Link>
        </p>
      )}
    </>
  );
}
