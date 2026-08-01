import { Link, Navigate, useParams } from "react-router-dom";
import { PreviewChrome } from "./PreviewChrome";
import {
  DemoAllocationDonut,
  DemoAreaChart,
  DemoTickerTape,
} from "./PreviewDemoCharts";
import { SignalFamilyPreview } from "./SignalFamilyPreview";
import "./previews.css";

const SLUGS = [
  "ledger",
  "harbor",
  "atelier",
  "signal",
  "signal-focus",
  "signal-depth",
  "signal-quiet",
  "signal-edge",
  "ticker",
  "folio",
  "pulse",
] as const;
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
      return (
        <SignalFamilyPreview
          chromeName="Signal clarity"
          slugClass="lp-preview--signal"
          headline="Signal over dashboard clutter"
          lead="One clear path in: authenticate, set your profile, keep your data local. More modules arrive feature by feature."
        />
      );
    case "signal-focus":
      return (
        <SignalFamilyPreview
          chromeName="Signal focus"
          slugClass="lp-preview--signal-focus"
          atmosphereClass="lp-preview__grid--fine"
          headline="Focus on the path, not the noise"
          lead="Cool slate and a clear emerald cue — same centered Signal layout, tuned for decisive first steps."
        />
      );
    case "signal-depth":
      return (
        <SignalFamilyPreview
          chromeName="Signal depth"
          slugClass="lp-preview--signal-depth"
          atmosphereClass="lp-preview__grid--soft"
          headline="Depth without dashboard clutter"
          lead="Charcoal ground and cobalt accent — the Signal structure, dialed for a quieter, deeper first impression."
        />
      );
    case "signal-quiet":
      return (
        <SignalFamilyPreview
          chromeName="Signal quiet"
          slugClass="lp-preview--signal-quiet"
          atmosphere="none"
          headline="Quiet entry. Clear next step."
          lead="Mist gray and ink-only CTAs — Signal clarity with saturation turned down to almost nothing."
        />
      );
    case "signal-edge":
      return (
        <SignalFamilyPreview
          chromeName="Signal edge"
          slugClass="lp-preview--signal-edge"
          atmosphere="hatch"
          headline="A sharp edge on a simple path"
          lead="Teal accent and a diagonal hatch — Signal’s centered story with a slightly harder graphic edge."
        />
      );
    case "ticker":
      return <TickerPreview />;
    case "folio":
      return <FolioPreview />;
    case "pulse":
      return <PulsePreview />;
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

function TickerPreview() {
  return (
    <PreviewChrome name="Ticker tape">
      <div className="lp-preview lp-preview--ticker">
        <DemoTickerTape className="lp-ticker lp-anim-fade" />
        <header className="lp-preview__top">
          <p className="lp-preview__brand lp-anim-fade lp-anim-delay-1">
            Finance Dashboard
          </p>
        </header>
        <main className="lp-preview__hero lp-ticker-hero">
          <div className="lp-ticker-copy lp-anim-fade lp-anim-delay-2">
            <h1 className="lp-preview__headline">Markets move. Your books stay yours.</h1>
            <p className="lp-preview__lead">
              A private instance for accounts and reports — illustrative tape and
              index curve, not live quotes.
            </p>
            <div className="lp-preview__cta">
              <Link to="/register" className="lp-btn lp-btn--ticker">
                Get started
              </Link>
              <Link to="/login" className="lp-btn lp-btn--ticker-ghost">
                Log in
              </Link>
            </div>
          </div>
          <DemoAreaChart className="lp-ticker-chart lp-anim-fade lp-anim-delay-3" height={180} />
        </main>
      </div>
    </PreviewChrome>
  );
}

function FolioPreview() {
  return (
    <PreviewChrome name="Folio buckets">
      <div className="lp-preview lp-preview--folio">
        <header className="lp-preview__top lp-preview__top--center">
          <p className="lp-preview__brand lp-anim-slide">Finance Dashboard</p>
        </header>
        <main className="lp-preview__hero lp-folio-hero">
          <div className="lp-folio-copy lp-anim-slide lp-anim-delay-1">
            <h1 className="lp-preview__headline">Five buckets. One private ledger.</h1>
            <p className="lp-preview__lead">
              See how cash, stocks, crypto, metals, and real estate could roll up —
              demo allocation only, until portfolio features ship.
            </p>
            <div className="lp-preview__cta lp-preview__cta--stack">
              <Link to="/register" className="lp-btn lp-btn--folio">
                Create your account
              </Link>
              <Link to="/login" className="lp-btn lp-btn--folio-ghost">
                Log in
              </Link>
            </div>
          </div>
          <DemoAllocationDonut className="lp-folio-donut lp-anim-slide lp-anim-delay-2" />
        </main>
      </div>
    </PreviewChrome>
  );
}

function PulsePreview() {
  return (
    <PreviewChrome name="Net-worth pulse">
      <div className="lp-preview lp-preview--pulse">
        <div className="lp-pulse-chart" aria-hidden>
          <DemoAreaChart height={420} />
        </div>
        <div className="lp-pulse-scrim" aria-hidden />
        <div className="lp-pulse-foreground">
          <p className="lp-preview__brand lp-anim-stagger">Finance Dashboard</p>
          <h1 className="lp-preview__headline lp-anim-stagger lp-anim-delay-1">
            Watch the curve of what you own
          </h1>
          <p className="lp-preview__lead lp-anim-stagger lp-anim-delay-2">
            A net-worth pulse as atmosphere — sample path only. Your data stays on
            your stack when the real dashboard arrives.
          </p>
          <div className="lp-preview__cta lp-anim-stagger lp-anim-delay-3">
            <Link to="/register" className="lp-btn lp-btn--pulse">
              Get started
            </Link>
            <Link to="/login" className="lp-btn lp-btn--pulse-ghost">
              I already have an account
            </Link>
          </div>
        </div>
      </div>
    </PreviewChrome>
  );
}
