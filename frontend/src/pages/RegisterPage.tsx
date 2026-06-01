import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/auth";

export function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejestracja nie powiodła się");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <h1 className="page-title">Rejestracja</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
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
            Hasło (min. 8 znaków)
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Tworzenie konta…" : "Utwórz konto"}
          </button>
        </form>
        <p className="auth-switch">
          Masz już konto? <Link to="/login">Zaloguj się</Link>
        </p>
      </div>
    </div>
  );
}
