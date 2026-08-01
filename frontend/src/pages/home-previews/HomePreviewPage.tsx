import { Link, Navigate, useParams } from "react-router-dom";
import { DemoAllocationDonut, DemoAreaChart } from "./HomeDemoCharts";
import { HomePreviewChrome } from "./HomePreviewChrome";
import "./home-previews.css";

const SLUGS = [
  "pulse-board",
  "command",
  "ledger-rail",
  "focus-stack",
  "grid-room",
  "mesh-stage",
  "hatch-split",
  "dot-orbit",
] as const;
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
    case "grid-room":
      return <GridRoomPreview />;
    case "mesh-stage":
      return <MeshStagePreview />;
    case "hatch-split":
      return <HatchSplitPreview />;
    case "dot-orbit":
      return <DotOrbitPreview />;
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

function GridRoomPreview() {
  return (
    <HomePreviewChrome name="Grid room">
      <div className="hp-shell hp-shell--grid-room">
        <div className="hp-atmos hp-atmos--grid" aria-hidden />
        <aside className="hp-float-panel hp-float-panel--nav">
          <p className="hp-logo">Finance Dashboard</p>
          <DemoUser />
          <nav className="hp-nav">
            <span className="hp-nav__active">Home</span>
            <span>Settings</span>
          </nav>
        </aside>
        <main className="hp-float-panel hp-float-panel--main">
          <p className="hp-focus__eyebrow">Workspace</p>
          <h1 className="hp-title">A room with a grid, not a blank wall</h1>
          <p className="hp-muted">
            Same Signal-style fine grid as the landing — the shell floats above it
            instead of sitting on flat color.
          </p>
          <div className="hp-focus__rule" aria-hidden />
          <DemoAreaChart height={220} />
          <ul className="hp-kpi-rows hp-kpi-rows--compact">
            <li>
              <span>Demo net worth</span>
              <strong>PLN 131,000</strong>
            </li>
            <li>
              <span>Month</span>
              <strong className="hp-positive">+5.6%</strong>
            </li>
          </ul>
        </main>
      </div>
    </HomePreviewChrome>
  );
}

function MeshStagePreview() {
  return (
    <HomePreviewChrome name="Mesh stage">
      <div className="hp-shell hp-shell--mesh-stage">
        <div className="hp-atmos hp-atmos--mesh" aria-hidden />
        <div className="hp-atmos hp-atmos--horizon" aria-hidden />
        <header className="hp-stage-top">
          <p className="hp-logo">Finance Dashboard</p>
          <nav className="hp-topbar__nav">
            <span className="hp-nav__active">Home</span>
            <span>Settings</span>
          </nav>
          <DemoUser />
        </header>
        <main className="hp-stage-card">
          <h1 className="hp-title">Stage your numbers on soft light</h1>
          <p className="hp-muted">
            Radial emerald washes and a quiet horizon — depth without a dashboard
            of cards.
          </p>
          <div className="hp-command__grid">
            <DemoAreaChart height={200} />
            <DemoAllocationDonut size={160} />
          </div>
        </main>
      </div>
    </HomePreviewChrome>
  );
}

function HatchSplitPreview() {
  return (
    <HomePreviewChrome name="Hatch split">
      <div className="hp-shell hp-shell--hatch-split">
        <div className="hp-atmos hp-atmos--hatch" aria-hidden />
        <section className="hp-split-pane hp-split-pane--copy">
          <p className="hp-ledger__brand">Finance Dashboard</p>
          <h1 className="hp-title">Split the canvas</h1>
          <DemoUser />
          <p className="hp-muted">
            Diagonal hatch as atmosphere; copy on the left, chart as a vertical
            plane on the right — one composition, two beats.
          </p>
          <div className="hp-focus__rule" aria-hidden />
          <Link to="/settings" className="btn-primary">
            Account settings
          </Link>
        </section>
        <section className="hp-split-pane hp-split-pane--viz" aria-hidden>
          <DemoAreaChart height={320} />
        </section>
      </div>
    </HomePreviewChrome>
  );
}

function DotOrbitPreview() {
  return (
    <HomePreviewChrome name="Dot orbit">
      <div className="hp-shell hp-shell--dot-orbit">
        <div className="hp-atmos hp-atmos--dots" aria-hidden />
        <div className="hp-atmos hp-atmos--ring" aria-hidden />
        <aside className="hp-rail hp-rail--overlay" aria-label="Demo navigation">
          <span className="hp-rail__mark" title="Home">
            H
          </span>
          <span className="hp-rail__mark" title="Settings">
            S
          </span>
        </aside>
        <main className="hp-orbit-center">
          <p className="hp-focus__eyebrow">Orbit</p>
          <h1 className="hp-title">Center the signal</h1>
          <p className="hp-muted">
            Dot field and a soft ring — the chart sits in the middle like a
            instrument panel, not a table dump.
          </p>
          <DemoAreaChart className="hp-orbit-chart" height={200} />
          <div className="hp-ledger__kpis hp-ledger__kpis--center">
            <span>
              Net <strong>131k</strong>
            </span>
            <span>
              YTD <strong className="hp-positive">+12%</strong>
            </span>
          </div>
        </main>
      </div>
    </HomePreviewChrome>
  );
}
