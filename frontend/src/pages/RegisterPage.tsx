import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { fetchAuthConfig } from "../api/authApi";
import { useAuth } from "../state/auth";

export function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
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
      await register(email, username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (allowRegister === false) {
    return <Navigate to="/login" replace />;
  }

  if (allowRegister === null) {
    return <p className="loading-state">Loading…</p>;
  }

  return (
    <>
      <p className="auth-swap-brand">Finance Dashboard</p>
      <h1 className="auth-swap-title">Create an account</h1>
      <form className="auth-swap-fields" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Username
          <input
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Password (min. 8 characters)
          <span className="auth-swap-password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="auth-swap-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </>
  );
}
