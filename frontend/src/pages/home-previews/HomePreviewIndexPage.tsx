import { Link } from "react-router-dom";
import { ThemeToggle } from "../../components/ThemeToggle";
import "./home-previews.css";

const VARIANTS = [
  {
    slug: "pulse-board",
    name: "Pulse board",
    blurb: "Classic left sidebar + large net-worth chart, KPI rows, next steps.",
    family: "layout",
  },
  {
    slug: "command",
    name: "Command strip",
    blurb: "Top navigation bar; greeting; chart beside allocation donut.",
    family: "layout",
  },
  {
    slug: "ledger-rail",
    name: "Ledger rail",
    blurb: "Narrow icon rail + wide canvas; brand welcome + full-bleed chart.",
    family: "layout",
  },
  {
    slug: "focus-stack",
    name: "Focus stack",
    blurb: "Sidebar + Signal-style centered stack with chart as atmosphere.",
    family: "layout",
  },
  {
    slug: "grid-room",
    name: "Grid room",
    blurb: "Landing-style fine grid under floating nav + content panels.",
    family: "atmosphere",
  },
  {
    slug: "mesh-stage",
    name: "Mesh stage",
    blurb: "Soft emerald mesh + horizon; content on a raised stage card.",
    family: "atmosphere",
  },
  {
    slug: "dot-orbit",
    name: "Dot orbit",
    blurb: "Dot field + soft ring; centered instrument-panel chart.",
    family: "atmosphere",
  },
  {
    slug: "hatch-split",
    name: "Hatch split",
    blurb: "Baseline: diagonal hatch; left copy + KPIs / right chart plane.",
    family: "hatch",
  },
  {
    slug: "hatch-invert",
    name: "Hatch invert",
    blurb: "Mirrored beat — chart plane leads, copy trails on the right.",
    family: "hatch",
  },
  {
    slug: "hatch-ledge",
    name: "Hatch ledge",
    blurb: "Horizontal split: welcome ledge above, full-width chart band.",
    family: "hatch",
  },
  {
    slug: "hatch-triptych",
    name: "Hatch triptych",
    blurb: "Three panes: copy, net-worth curve, allocation donut.",
    family: "hatch",
  },
  {
    slug: "hatch-spine",
    name: "Hatch spine",
    blurb: "Dual panes joined by an emerald vertical spine.",
    family: "hatch",
  },
  {
    slug: "hatch-folio",
    name: "Hatch folio",
    blurb: "Asymmetric 38/62 mast + editorial folio page.",
    family: "hatch",
  },
  {
    slug: "hatch-ribbon",
    name: "Hatch ribbon",
    blurb: "Thin top ribbon chrome + classic left/right split body.",
    family: "hatch",
  },
] as const;

const SECTIONS = [
  { id: "layout", title: "Layout baselines" },
  { id: "atmosphere", title: "Atmosphere" },
  { id: "hatch", title: "Hatch family" },
] as const;

export function HomePreviewIndexPage() {
  return (
    <div className="hp-gallery">
      <header className="hp-gallery__header">
        <div className="hp-gallery__header-row">
          <h1 className="hp-gallery__title">Home layout previews</h1>
          <ThemeToggle />
        </div>
        <p className="hp-gallery__lead">
          Temporary gallery for authenticated-home concepts. Production{" "}
          <Link to="/home">/home</Link> is unchanged. Open a variant, then tell us
          which slug to promote.
        </p>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.id} className="hp-gallery__section">
          <h2 className="hp-gallery__section-title">{section.title}</h2>
          <ul className="hp-gallery__list">
            {VARIANTS.filter((v) => v.family === section.id).map((v) => (
              <li key={v.slug} className="hp-gallery__item">
                <Link to={`/preview/home/${v.slug}`} className="hp-gallery__link">
                  <span className="hp-gallery__name">{v.name}</span>
                  <span className="hp-gallery__slug">/preview/home/{v.slug}</span>
                  <span className="hp-gallery__blurb">{v.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="hp-gallery__current">
        <Link to="/">Back to landing (/)</Link>
      </p>
    </div>
  );
}
