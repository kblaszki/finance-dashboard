import { Link } from "react-router-dom";
import { ThemeToggle } from "../../components/ThemeToggle";
import "./home-previews.css";

const VARIANTS = [
  {
    slug: "pulse-board",
    name: "Pulse board",
    blurb: "Classic left sidebar + large net-worth chart, KPI rows, next steps.",
  },
  {
    slug: "command",
    name: "Command strip",
    blurb: "Top navigation bar; greeting; chart beside allocation donut.",
  },
  {
    slug: "ledger-rail",
    name: "Ledger rail",
    blurb: "Narrow icon rail + wide canvas; brand welcome + full-bleed chart.",
  },
  {
    slug: "focus-stack",
    name: "Focus stack",
    blurb: "Sidebar + Signal-style centered stack with chart as atmosphere.",
  },
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
      <ul className="hp-gallery__list">
        {VARIANTS.map((v) => (
          <li key={v.slug} className="hp-gallery__item">
            <Link to={`/preview/home/${v.slug}`} className="hp-gallery__link">
              <span className="hp-gallery__name">{v.name}</span>
              <span className="hp-gallery__slug">/preview/home/{v.slug}</span>
              <span className="hp-gallery__blurb">{v.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="hp-gallery__current">
        <Link to="/">Back to landing (/)</Link>
      </p>
    </div>
  );
}
