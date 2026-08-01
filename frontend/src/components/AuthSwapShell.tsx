import { Outlet, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

export function AuthSwapShell() {
  const { pathname } = useLocation();
  const mode = pathname.startsWith("/register") ? "register" : "login";

  return (
    <div className="auth-swap" data-mode={mode}>
      <div className="auth-swap-theme">
        <ThemeToggle />
      </div>
      <section className="auth-swap-form">
        <Outlet />
      </section>
      <section className="auth-swap-visual" aria-hidden>
        <div className="auth-swap-grid" />
        <div className="auth-swap-visual__content">
          <div className="auth-swap-cards">
            <div className="auth-swap-card auth-swap-card--chart">
              <div className="auth-swap-card__tabs">
                <span className="auth-swap-card__tab auth-swap-card__tab--active">Weekly</span>
                <span className="auth-swap-card__tab">Monthly</span>
                <span className="auth-swap-card__tab">Yearly</span>
              </div>
              <svg
                className="auth-swap-card__svg"
                viewBox="0 0 280 120"
                xmlns="http://www.w3.org/2000/svg"
                role="presentation"
              >
                <defs>
                  <linearGradient id="auth-swap-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 90 L40 72 L80 78 L120 48 L160 58 L200 32 L240 40 L280 22 L280 120 L0 120 Z"
                  fill="url(#auth-swap-fill)"
                />
                <path
                  d="M0 90 L40 72 L80 78 L120 48 L160 58 L200 32 L240 40 L280 22"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="auth-swap-card__days">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
              </div>
            </div>
            <div className="auth-swap-card auth-swap-card--donut">
              <svg viewBox="0 0 72 72" className="auth-swap-donut" role="presentation">
                <circle
                  cx="36"
                  cy="36"
                  r="26"
                  fill="none"
                  stroke="color-mix(in srgb, var(--color-border) 80%, transparent)"
                  strokeWidth="8"
                />
                <circle
                  cx="36"
                  cy="36"
                  r="26"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="68 163"
                  transform="rotate(-90 36 36)"
                />
                <text x="36" y="34" textAnchor="middle" className="auth-swap-donut__label">
                  Total
                </text>
                <text x="36" y="48" textAnchor="middle" className="auth-swap-donut__value">
                  42%
                </text>
              </svg>
            </div>
          </div>
          <h2 className="auth-swap-visual__title">Focus on the path, not the noise</h2>
          <p className="auth-swap-visual__lead">
            A private workspace for accounts and reports — authenticate, set your
            profile, keep data on your instance.
          </p>
        </div>
      </section>
    </div>
  );
}
