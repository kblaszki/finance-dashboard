import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AuthMockForm } from "./AuthMockForm";
import type { AuthMode } from "./AuthMockForm";
import { AuthPreviewChrome } from "./AuthPreviewChrome";
import "./auth-previews.css";

const SLUGS = [
  "signal-card",
  "hatch-split-auth",
  "hatch-folio-auth",
  "grid-room-auth",
  "mesh-stage-auth",
  "ledge-auth",
  "swap-split",
] as const;
type Slug = (typeof SLUGS)[number];

function isSlug(value: string | undefined): value is Slug {
  return value != null && (SLUGS as readonly string[]).includes(value);
}

export function AuthPreviewPage() {
  const { slug } = useParams();
  if (!isSlug(slug)) {
    return <Navigate to="/preview/auth" replace />;
  }

  switch (slug) {
    case "signal-card":
      return <SignalCardPreview />;
    case "hatch-split-auth":
      return <HatchSplitAuthPreview />;
    case "hatch-folio-auth":
      return <HatchFolioAuthPreview />;
    case "grid-room-auth":
      return <GridRoomAuthPreview />;
    case "mesh-stage-auth":
      return <MeshStageAuthPreview />;
    case "ledge-auth":
      return <LedgeAuthPreview />;
    case "swap-split":
      return <SwapSplitPreview />;
  }
}

function BrandCopy() {
  return (
    <>
      <p className="ap-brand">Finance Dashboard</p>
      <h1 className="ap-headline">Your private ledger</h1>
      <p className="ap-lead">
        Sign in to manage your account. Portfolio tools arrive from the roadmap —
        this preview is layout only.
      </p>
      <div className="ap-rule" aria-hidden />
    </>
  );
}

function SignalCardPreview() {
  return (
    <AuthPreviewChrome name="Signal card">
      <div className="ap-shell ap-shell--signal">
        <AuthMockForm className="ap-form-panel--card" />
      </div>
    </AuthPreviewChrome>
  );
}

function HatchSplitAuthPreview() {
  return (
    <AuthPreviewChrome name="Hatch split">
      <div className="ap-shell ap-shell--hatch-split">
        <div className="ap-atmos ap-atmos--hatch" aria-hidden />
        <section className="ap-split-copy">
          <BrandCopy />
        </section>
        <section className="ap-split-form">
          <AuthMockForm />
        </section>
      </div>
    </AuthPreviewChrome>
  );
}

function HatchFolioAuthPreview() {
  return (
    <AuthPreviewChrome name="Hatch folio">
      <div className="ap-shell ap-shell--hatch-folio">
        <div className="ap-atmos ap-atmos--hatch" aria-hidden />
        <aside className="ap-folio-mast">
          <BrandCopy />
          <p className="ap-mast-note">
            Same shell language as the authenticated hatch folio — for guests.
          </p>
        </aside>
        <main className="ap-folio-page">
          <AuthMockForm />
        </main>
      </div>
    </AuthPreviewChrome>
  );
}

function GridRoomAuthPreview() {
  return (
    <AuthPreviewChrome name="Grid room">
      <div className="ap-shell ap-shell--grid-room">
        <div className="ap-atmos ap-atmos--grid" aria-hidden />
        <div className="ap-float">
          <p className="ap-brand ap-brand--center">Finance Dashboard</p>
          <AuthMockForm />
        </div>
      </div>
    </AuthPreviewChrome>
  );
}

function MeshStageAuthPreview() {
  return (
    <AuthPreviewChrome name="Mesh stage">
      <div className="ap-shell ap-shell--mesh-stage">
        <div className="ap-atmos ap-atmos--mesh" aria-hidden />
        <div className="ap-atmos ap-atmos--horizon" aria-hidden />
        <header className="ap-stage-top">
          <p className="ap-brand">Finance Dashboard</p>
        </header>
        <main className="ap-stage-card">
          <p className="ap-lead ap-lead--tight">
            Soft light under a raised form — depth without a busy dashboard.
          </p>
          <AuthMockForm />
        </main>
      </div>
    </AuthPreviewChrome>
  );
}

function LedgeAuthPreview() {
  return (
    <AuthPreviewChrome name="Ledge">
      <div className="ap-shell ap-shell--ledge">
        <div className="ap-atmos ap-atmos--hatch" aria-hidden />
        <header className="ap-ledge">
          <BrandCopy />
        </header>
        <section className="ap-ledge-band">
          <AuthMockForm className="ap-form-panel--wide" />
        </section>
      </div>
    </AuthPreviewChrome>
  );
}

function SwapSplitPreview() {
  const [mode, setMode] = useState<AuthMode>("register");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthPreviewChrome name="Swap split">
      <div className="ap-shell ap-shell--swap-split" data-mode={mode}>
        <section className="ap-swap-form">
          <p className="ap-brand">Finance Dashboard</p>
          <h1 className="ap-swap-title">
            {mode === "register" ? "Create an account" : "Log in"}
          </h1>
          <form
            className="ap-swap-fields"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {mode === "register" ? (
              <>
                <label>
                  Email
                  <input type="email" autoComplete="email" placeholder="you@example.com" />
                </label>
                <label>
                  Username
                  <input type="text" autoComplete="username" placeholder="demo" />
                </label>
              </>
            ) : (
              <label>
                Email or username
                <input type="text" autoComplete="username" placeholder="demo" />
              </label>
            )}
            <label>
              Password
              <span className="ap-swap-password">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="ap-swap-password__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            <button type="submit" className="btn-primary ap-swap-submit" disabled>
              {mode === "register" ? "Sign up (preview)" : "Log in (preview)"}
            </button>
          </form>
          <p className="ap-swap-switch">
            {mode === "register" ? (
              <>
                Already have an account?{" "}
                <button type="button" className="ap-swap-switch__btn" onClick={() => setMode("login")}>
                  Log in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="ap-swap-switch__btn"
                  onClick={() => setMode("register")}
                >
                  Sign up
                </button>
              </>
            )}
          </p>
          <p className="ap-form-note">Mock form — production pages are unchanged.</p>
        </section>

        <section className="ap-swap-visual" aria-hidden>
          <div className="ap-atmos ap-atmos--grid ap-atmos--swap-grid" />
          <div className="ap-swap-visual__content">
            <div className="ap-swap-cards">
              <div className="ap-swap-card ap-swap-card--chart">
                <div className="ap-swap-card__tabs">
                  <span className="ap-swap-card__tab ap-swap-card__tab--active">Weekly</span>
                  <span className="ap-swap-card__tab">Monthly</span>
                  <span className="ap-swap-card__tab">Yearly</span>
                </div>
                <svg
                  className="ap-swap-card__svg"
                  viewBox="0 0 280 120"
                  xmlns="http://www.w3.org/2000/svg"
                  role="presentation"
                >
                  <defs>
                    <linearGradient id="ap-swap-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 90 L40 72 L80 78 L120 48 L160 58 L200 32 L240 40 L280 22 L280 120 L0 120 Z"
                    fill="url(#ap-swap-fill)"
                  />
                  <path
                    d="M0 90 L40 72 L80 78 L120 48 L160 58 L200 32 L240 40 L280 22"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="ap-swap-card__days">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                </div>
              </div>
              <div className="ap-swap-card ap-swap-card--donut">
                <svg viewBox="0 0 72 72" className="ap-swap-donut" role="presentation">
                  <circle
                    cx="36"
                    cy="36"
                    r="26"
                    fill="none"
                    stroke="color-mix(in srgb, var(--color-border) 80%, transparent)"
                    strokeWidth="8"
                  />
                  <circle
                    className="ap-swap-donut__arc"
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
                  <text
                    x="36"
                    y="34"
                    textAnchor="middle"
                    className="ap-swap-donut__label"
                  >
                    Total
                  </text>
                  <text
                    x="36"
                    y="48"
                    textAnchor="middle"
                    className="ap-swap-donut__value"
                  >
                    42%
                  </text>
                </svg>
              </div>
            </div>
            <h2 className="ap-swap-visual__title">Focus on the path, not the noise</h2>
            <p className="ap-swap-visual__lead">
              A private workspace for accounts and reports — authenticate, set your
              profile, keep data on your instance.
            </p>
          </div>
        </section>
      </div>
    </AuthPreviewChrome>
  );
}
