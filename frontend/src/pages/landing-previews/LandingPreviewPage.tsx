import { Link, Navigate, useParams } from "react-router-dom";
import { PreviewChrome } from "./PreviewChrome";
import "./previews.css";

const SLUGS = ["ledger", "harbor", "atelier", "signal"] as const;
type Slug = (typeof SLUGS)[number];

function isSlug(value: string | undefined): value is Slug {
  return value != null && (SLUGS as readonly string[]).includes(value);
}

export function LandingPreviewPage() {
  const { slug } = useParams();
  if (!isSlug(slug)) {
    return <Navigate to="/preview" replace />;
  }

  switch (slug) {
    case "ledger":
      return <LedgerPreview />;
    case "harbor":
      return <HarborPreview />;
    case "atelier":
      return <AtelierPreview />;
    case "signal":
      return <SignalPreview />;
  }
}

function LedgerPreview() {
  return (
    <PreviewChrome name="Ledger calm">
      <div className="lp-preview lp-preview--ledger">
        <div className="lp-preview__mesh" aria-hidden />
        <header className="lp-preview__top">
          <p className="lp-preview__brand lp-anim-fade">Finance Dashboard</p>
        </header>
        <main className="lp-preview__hero">
          <h1 className="lp-preview__headline lp-anim-fade lp-anim-delay-1">
            Your numbers, kept private
          </h1>
          <p className="lp-preview__lead lp-anim-fade lp-anim-delay-2">
            A personal workspace for accounts and reports you control — data stays
            on your instance, not on someone else&apos;s cloud dashboard.
          </p>
          <div className="lp-preview__cta lp-anim-fade lp-anim-delay-3">
            <Link to="/register" className="lp-btn lp-btn--primary">
              Get started
            </Link>
            <Link to="/login" className="lp-btn lp-btn--ghost">
              I already have an account
            </Link>
          </div>
        </main>
        <section className="lp-preview__below" aria-label="Values">
          <ul className="lp-preview__values">
            <li>
              <strong>Private by default</strong>
              <span>Single-user or invite-only registration</span>
            </li>
            <li>
              <strong>Built for ownership</strong>
              <span>You run the stack; you keep the database</span>
            </li>
            <li>
              <strong>Growing with you</strong>
              <span>Auth and settings today; portfolio tools on the roadmap</span>
            </li>
          </ul>
        </section>
      </div>
    </PreviewChrome>
  );
}

function HarborPreview() {
  return (
    <PreviewChrome name="Harbor trust">
      <div className="lp-preview lp-preview--harbor">
        <div className="lp-preview__horizon" aria-hidden />
        <header className="lp-preview__top lp-preview__top--center">
          <p className="lp-preview__brand lp-anim-slide">Finance Dashboard</p>
        </header>
        <main className="lp-preview__hero lp-preview__hero--center">
          <h1 className="lp-preview__headline lp-anim-slide lp-anim-delay-1">
            A quiet harbor for your finances
          </h1>
          <p className="lp-preview__lead lp-anim-slide lp-anim-delay-2">
            Sign in to a space built for clarity and control — no ads, no shared
            tenant noise, just your books.
          </p>
          <div className="lp-preview__cta lp-preview__cta--stack lp-anim-slide lp-anim-delay-3">
            <Link to="/register" className="lp-btn lp-btn--harbor-primary">
              Create your account
            </Link>
            <Link to="/login" className="lp-btn lp-btn--harbor-link">
              Log in
            </Link>
          </div>
        </main>
        <section className="lp-preview__below lp-preview__below--band">
          <p className="lp-preview__band">
            <strong>Private by default.</strong> Registration can be locked; you
            create users on your own server.
          </p>
        </section>
      </div>
    </PreviewChrome>
  );
}

function AtelierPreview() {
  return (
    <PreviewChrome name="Atelier modern">
      <div className="lp-preview lp-preview--atelier">
        <div className="lp-preview__blobs" aria-hidden>
          <span className="lp-blob lp-blob--a" />
          <span className="lp-blob lp-blob--b" />
        </div>
        <div className="lp-preview__split">
          <div className="lp-preview__split-brand">
            <p className="lp-preview__brand lp-anim-stagger">Finance Dashboard</p>
            <h1 className="lp-preview__headline lp-anim-stagger lp-anim-delay-1">
              Design your money life without the noise
            </h1>
            <p className="lp-preview__lead lp-anim-stagger lp-anim-delay-2">
              Start with a secure login and account settings. Expand into
              portfolios and tax helpers when you are ready.
            </p>
          </div>
          <div className="lp-preview__split-cta lp-anim-stagger lp-anim-delay-3">
            <Link to="/register" className="lp-btn lp-btn--atelier">
              Get started
            </Link>
            <Link to="/login" className="lp-btn lp-btn--atelier-ghost">
              Log in
            </Link>
          </div>
        </div>
        <section className="lp-preview__below">
          <ol className="lp-preview__steps">
            <li>
              <span className="lp-preview__num">01</span>
              Create an account on your instance
            </li>
            <li>
              <span className="lp-preview__num">02</span>
              Manage profile, email, and password
            </li>
            <li>
              <span className="lp-preview__num">03</span>
              Add finance features from the product roadmap
            </li>
          </ol>
        </section>
      </div>
    </PreviewChrome>
  );
}

function SignalPreview() {
  return (
    <PreviewChrome name="Signal clarity">
      <div className="lp-preview lp-preview--signal">
        <div className="lp-preview__grid" aria-hidden />
        <header className="lp-preview__top lp-preview__top--center">
          <p className="lp-preview__brand lp-anim-grid">Finance Dashboard</p>
        </header>
        <main className="lp-preview__hero lp-preview__hero--center">
          <h1 className="lp-preview__headline lp-anim-grid lp-anim-delay-1">
            Signal over dashboard clutter
          </h1>
          <p className="lp-preview__lead lp-anim-grid lp-anim-delay-2">
            One clear path in: authenticate, set your profile, keep your data
            local. More modules arrive feature by feature.
          </p>
          <div className="lp-preview__rule" aria-hidden />
          <div className="lp-preview__cta lp-anim-grid lp-anim-delay-3">
            <Link to="/register" className="lp-btn lp-btn--signal">
              Get started
            </Link>
            <Link to="/login" className="lp-btn lp-btn--signal-ghost">
              I already have an account
            </Link>
          </div>
        </main>
        <section className="lp-preview__below lp-preview__below--split-copy">
          <div>
            <h2 className="lp-preview__subhead">What you get today</h2>
            <p>Login, registration, and account settings on your own stack.</p>
          </div>
          <div>
            <h2 className="lp-preview__subhead">Roadmap</h2>
            <p>
              Accounts, portfolio, and tax tooling land step by step from the
              product checklist — not pretended as live UI yet.
            </p>
          </div>
        </section>
      </div>
    </PreviewChrome>
  );
}
