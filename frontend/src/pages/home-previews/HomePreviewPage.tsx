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
  "hatch-invert",
  "hatch-ledge",
  "hatch-triptych",
  "hatch-spine",
  "hatch-folio",
  "hatch-ribbon",
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
    case "hatch-invert":
      return <HatchInvertPreview />;
    case "hatch-ledge":
      return <HatchLedgePreview />;
    case "hatch-triptych":
      return <HatchTriptychPreview />;
    case "hatch-spine":
      return <HatchSpinePreview />;
    case "hatch-folio":
      return <HatchFolioPreview />;
    case "hatch-ribbon":
      return <HatchRibbonPreview />;
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
        <div className="hp-atmos hp-atmos--hatch-dense" aria-hidden />
        <section className="hp-split-pane hp-split-pane--copy">
          <p className="hp-focus__eyebrow">Hatch family</p>
          <p className="hp-ledger__brand">Finance Dashboard</p>
          <h1 className="hp-title">Split the canvas</h1>
          <DemoUser />
          <p className="hp-muted">
            Diagonal hatch as atmosphere; copy on the left, chart as a vertical
            plane on the right — one composition, two beats.
          </p>
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
          <div className="hp-focus__rule" aria-hidden />
          <Link to="/settings" className="btn-primary">
            Account settings
          </Link>
        </section>
        <section className="hp-split-pane hp-split-pane--viz">
          <p className="hp-subhead">Net worth (demo)</p>
          <DemoAreaChart height={300} />
        </section>
      </div>
    </HomePreviewChrome>
  );
}

function HatchInvertPreview() {
  return (
    <HomePreviewChrome name="Hatch invert">
      <div className="hp-shell hp-shell--hatch-invert">
        <div className="hp-atmos hp-atmos--hatch hp-atmos--hatch-flip" aria-hidden />
        <section className="hp-split-pane hp-split-pane--viz hp-split-pane--viz-lead">
          <p className="hp-subhead">Net worth (demo)</p>
          <DemoAreaChart height={300} />
        </section>
        <section className="hp-split-pane hp-split-pane--copy">
          <p className="hp-focus__eyebrow">Inverted</p>
          <p className="hp-ledger__brand">Finance Dashboard</p>
          <h1 className="hp-title">Chart leads, words follow</h1>
          <DemoUser />
          <p className="hp-muted">
            Same hatch language, mirrored beat — visual plane first, copy on the
            trailing edge.
          </p>
          <div className="hp-focus__rule" aria-hidden />
          <Link to="/settings" className="btn-primary">
            Account settings
          </Link>
        </section>
      </div>
    </HomePreviewChrome>
  );
}

function HatchLedgePreview() {
  return (
    <HomePreviewChrome name="Hatch ledge">
      <div className="hp-shell hp-shell--hatch-ledge">
        <div className="hp-atmos hp-atmos--hatch" aria-hidden />
        <header className="hp-ledge-copy">
          <div className="hp-ledge-copy__text">
            <p className="hp-ledger__brand">Finance Dashboard</p>
            <h1 className="hp-title">Copy on a ledge</h1>
            <p className="hp-muted">
              Horizontal split: welcome strip above, chart as a full-width band
              below — hatch stays in the room.
            </p>
          </div>
          <div className="hp-ledge-copy__meta">
            <DemoUser />
            <nav className="hp-topbar__nav">
              <span className="hp-nav__active">Home</span>
              <span>Settings</span>
            </nav>
          </div>
        </header>
        <section className="hp-ledge-band">
          <DemoAreaChart height={260} />
        </section>
      </div>
    </HomePreviewChrome>
  );
}

function HatchTriptychPreview() {
  return (
    <HomePreviewChrome name="Hatch triptych">
      <div className="hp-shell hp-shell--hatch-triptych">
        <div className="hp-atmos hp-atmos--hatch" aria-hidden />
        <section className="hp-trip-pane hp-trip-pane--copy">
          <p className="hp-ledger__brand">Finance Dashboard</p>
          <h1 className="hp-title">Three beats</h1>
          <DemoUser />
          <p className="hp-muted">
            Copy, curve, allocation — a triptych over the same hatch field.
          </p>
          <Link to="/settings" className="btn-primary">
            Account settings
          </Link>
        </section>
        <section className="hp-trip-pane hp-trip-pane--mid">
          <p className="hp-subhead">Net worth</p>
          <DemoAreaChart height={240} />
        </section>
        <section className="hp-trip-pane hp-trip-pane--side">
          <p className="hp-subhead">Allocation</p>
          <DemoAllocationDonut size={150} />
        </section>
      </div>
    </HomePreviewChrome>
  );
}

function HatchSpinePreview() {
  return (
    <HomePreviewChrome name="Hatch spine">
      <div className="hp-shell hp-shell--hatch-spine">
        <div className="hp-atmos hp-atmos--hatch" aria-hidden />
        <section className="hp-spine-pane hp-spine-pane--copy">
          <p className="hp-focus__eyebrow">Spine</p>
          <p className="hp-ledger__brand">Finance Dashboard</p>
          <h1 className="hp-title">Two rooms, one seam</h1>
          <DemoUser />
          <p className="hp-muted">
            Dual panes meet at an emerald spine — hatch behind, structure in
            front.
          </p>
          <ul className="hp-kpi-rows hp-kpi-rows--compact">
            <li>
              <span>YTD</span>
              <strong className="hp-positive">+12%</strong>
            </li>
            <li>
              <span>Cash</span>
              <strong>22%</strong>
            </li>
          </ul>
        </section>
        <div className="hp-spine" aria-hidden />
        <section className="hp-spine-pane hp-spine-pane--viz">
          <DemoAreaChart height={280} />
        </section>
      </div>
    </HomePreviewChrome>
  );
}

function HatchFolioPreview() {
  return (
    <HomePreviewChrome name="Hatch folio">
      <div className="hp-shell hp-shell--hatch-folio">
        <div className="hp-atmos hp-atmos--hatch" aria-hidden />
        <aside className="hp-folio-mast">
          <p className="hp-ledger__brand">Finance Dashboard</p>
          <nav className="hp-nav">
            <span className="hp-nav__active">Home</span>
            <span>Settings</span>
          </nav>
          <DemoUser />
          <p className="hp-muted hp-folio-mast__note">
            Narrow mast over hatch; wide folio for the story and chart.
          </p>
        </aside>
        <main className="hp-folio-page">
          <h1 className="hp-title">Open the folio</h1>
          <p className="hp-muted">
            Asymmetric 38 / 62 — editorial column plus a calm chart plane.
          </p>
          <div className="hp-focus__rule" aria-hidden />
          <DemoAreaChart height={240} />
          <div className="hp-ledger__kpis">
            <span>
              Net <strong>131k</strong>
            </span>
            <span>
              Month <strong className="hp-positive">+5.6%</strong>
            </span>
          </div>
        </main>
      </div>
    </HomePreviewChrome>
  );
}

function HatchRibbonPreview() {
  return (
    <HomePreviewChrome name="Hatch ribbon">
      <div className="hp-shell hp-shell--hatch-ribbon">
        <div className="hp-atmos hp-atmos--hatch" aria-hidden />
        <header className="hp-ribbon">
          <p className="hp-logo">Finance Dashboard</p>
          <nav className="hp-topbar__nav">
            <span className="hp-nav__active">Home</span>
            <span>Settings</span>
          </nav>
          <DemoUser />
        </header>
        <div className="hp-ribbon-body">
          <section className="hp-split-pane hp-split-pane--copy">
            <p className="hp-focus__eyebrow">Ribbon + split</p>
            <h1 className="hp-title">Nav as a thin ribbon</h1>
            <p className="hp-muted">
              Hatch underneath; chrome as a hairline bar; classic left/right
              split for content.
            </p>
            <div className="hp-focus__rule" aria-hidden />
            <Link to="/settings" className="btn-primary">
              Account settings
            </Link>
          </section>
          <section className="hp-split-pane hp-split-pane--viz">
            <DemoAreaChart height={280} />
            <DemoAllocationDonut size={140} />
          </section>
        </div>
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
