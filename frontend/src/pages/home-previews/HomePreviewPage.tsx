import { Link, Navigate, useParams } from "react-router-dom";
import { DemoAllocationDonut, DemoAreaChart } from "./HomeDemoCharts";
import { HomePreviewChrome } from "./HomePreviewChrome";
import "./home-previews.css";

const SLUGS = ["pulse-board", "command", "ledger-rail", "focus-stack"] as const;
type Slug = (typeof SLUGS)[number];

function isSlug(value: string | undefined): value is Slug {
  return value != null && (SLUGS as readonly string[]).includes(value);
}

export function HomePreviewPage() {
  const { slug } = useParams();
  if (!isSlug(slug)) {
    return <Navigate to="/preview/home" replace />;
  }

  switch (slug) {
    case "pulse-board":
      return <PulseBoardPreview />;
    case "command":
      return <CommandPreview />;
    case "ledger-rail":
      return <LedgerRailPreview />;
    case "focus-stack":
      return <FocusStackPreview />;
  }
}

function DemoUser() {
  return <p className="hp-demo-user">Signed in as <strong>demo</strong> (preview)</p>;
}

function PulseBoardPreview() {
  return (
    <HomePreviewChrome name="Pulse board">
      <div className="hp-shell hp-shell--sidebar">
        <aside className="hp-sidebar">
          <p className="hp-logo">Finance Dashboard</p>
          <DemoUser />
          <nav className="hp-nav">
            <span className="hp-nav__active">Home</span>
            <span>Settings</span>
          </nav>
        </aside>
        <main className="hp-main hp-pulse">
          <header className="hp-pulse__header">
            <h1 className="hp-title">Net worth pulse</h1>
            <p className="hp-muted">Illustrative curve — not live data.</p>
          </header>
          <DemoAreaChart className="hp-pulse__chart" height={260} />
          <ul className="hp-kpi-rows">
            <li>
              <span>Total (demo)</span>
              <strong>PLN 131,000</strong>
            </li>
            <li>
              <span>Month change</span>
              <strong className="hp-positive">+5.6%</strong>
            </li>
            <li>
              <span>Accounts</span>
              <strong>4 linked</strong>
            </li>
          </ul>
          <section className="hp-next">
            <h2 className="hp-subhead">Next steps</h2>
            <ul>
              <li>Complete profile in Settings</li>
              <li>Add accounts when the module ships</li>
              <li>Review tax roadmap later</li>
            </ul>
          </section>
        </main>
      </div>
    </HomePreviewChrome>
  );
}

function CommandPreview() {
  return (
    <HomePreviewChrome name="Command strip">
      <div className="hp-shell hp-shell--command">
        <header className="hp-topbar">
          <p className="hp-logo">Finance Dashboard</p>
          <nav className="hp-topbar__nav">
            <span className="hp-nav__active">Home</span>
            <span>Settings</span>
          </nav>
          <DemoUser />
        </header>
        <main className="hp-main hp-command">
          <h1 className="hp-title">Good to see you, demo</h1>
          <p className="hp-muted">
            A command-style home: one greeting, then signal over clutter.
          </p>
          <div className="hp-command__grid">
            <div>
              <h2 className="hp-subhead">Net worth</h2>
              <DemoAreaChart height={220} />
            </div>
            <div>
              <h2 className="hp-subhead">Allocation</h2>
              <DemoAllocationDonut size={180} />
            </div>
          </div>
        </main>
      </div>
    </HomePreviewChrome>
  );
}

function LedgerRailPreview() {
  return (
    <HomePreviewChrome name="Ledger rail">
      <div className="hp-shell hp-shell--rail">
        <aside className="hp-rail" aria-label="Demo navigation">
          <span className="hp-rail__mark" title="Home">
            H
          </span>
          <span className="hp-rail__mark" title="Settings">
            S
          </span>
        </aside>
        <main className="hp-main hp-ledger">
          <p className="hp-ledger__brand">Finance Dashboard</p>
          <h1 className="hp-title">Your private ledger</h1>
          <DemoUser />
          <div className="hp-ledger__kpis">
            <span>
              Net worth <strong>131k</strong>
            </span>
            <span>
              YTD <strong className="hp-positive">+12%</strong>
            </span>
            <span>
              Cash <strong>22%</strong>
            </span>
          </div>
          <DemoAreaChart className="hp-ledger__chart" height={280} />
        </main>
      </div>
    </HomePreviewChrome>
  );
}

function FocusStackPreview() {
  return (
    <HomePreviewChrome name="Focus stack">
      <div className="hp-shell hp-shell--sidebar">
        <aside className="hp-sidebar">
          <p className="hp-logo">Finance Dashboard</p>
          <DemoUser />
          <nav className="hp-nav">
            <span className="hp-nav__active">Home</span>
            <span>Settings</span>
          </nav>
        </aside>
        <main className="hp-main hp-focus">
          <div className="hp-focus__chart" aria-hidden>
            <DemoAreaChart height={360} />
          </div>
          <div className="hp-focus__scrim" aria-hidden />
          <div className="hp-focus__fg">
            <p className="hp-focus__eyebrow">Home</p>
            <h1 className="hp-title">Focus on what matters next</h1>
            <p className="hp-muted">
              Auth and settings today. Portfolio tools arrive from the roadmap —
              this chart is atmosphere only.
            </p>
            <div className="hp-focus__rule" aria-hidden />
            <Link to="/settings" className="btn-primary">
              Account settings
            </Link>
          </div>
        </main>
      </div>
    </HomePreviewChrome>
  );
}
