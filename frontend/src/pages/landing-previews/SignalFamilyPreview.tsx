import { Link } from "react-router-dom";
import { PreviewChrome } from "./PreviewChrome";

type Atmosphere = "grid" | "hatch" | "none";

type SignalFamilyPreviewProps = {
  chromeName: string;
  slugClass: string;
  headline: string;
  lead: string;
  atmosphere?: Atmosphere;
  /** Extra class on the atmosphere layer (grid density, etc.) */
  atmosphereClass?: string;
};

export function SignalFamilyPreview({
  chromeName,
  slugClass,
  headline,
  lead,
  atmosphere = "grid",
  atmosphereClass,
}: SignalFamilyPreviewProps) {
  const atmosphereEl =
    atmosphere === "none" ? null : (
      <div
        className={
          atmosphere === "hatch"
            ? `lp-preview__hatch ${atmosphereClass ?? ""}`.trim()
            : `lp-preview__grid ${atmosphereClass ?? ""}`.trim()
        }
        aria-hidden
      />
    );

  return (
    <PreviewChrome name={chromeName}>
      <div className={`lp-preview ${slugClass}`}>
        {atmosphereEl}
        <header className="lp-preview__top lp-preview__top--center">
          <p className="lp-preview__brand lp-anim-grid">Finance Dashboard</p>
        </header>
        <main className="lp-preview__hero lp-preview__hero--center">
          <h1 className="lp-preview__headline lp-anim-grid lp-anim-delay-1">
            {headline}
          </h1>
          <p className="lp-preview__lead lp-anim-grid lp-anim-delay-2">{lead}</p>
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
