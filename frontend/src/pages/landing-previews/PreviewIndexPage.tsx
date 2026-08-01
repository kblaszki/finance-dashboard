import { Link } from "react-router-dom";
import { ThemeToggle } from "../../components/ThemeToggle";
import "./previews.css";

const VARIANTS = [
  {
    slug: "ledger",
    name: "Ledger calm",
    blurb: "Stone ground, forest accent, Fraunces — quiet private register.",
  },
  {
    slug: "harbor",
    name: "Harbor trust",
    blurb: "Navy and copper — a calm port for personal wealth.",
  },
  {
    slug: "atelier",
    name: "Atelier modern",
    blurb: "Teal on off-white, Syne — geometric and asymmetric.",
  },
  {
    slug: "signal",
    name: "Signal clarity",
    blurb: "Amber on cool gray, Space Grotesk — clear signal, less noise.",
  },
] as const;

export function PreviewIndexPage() {
  return (
    <div className="lp-gallery">
      <header className="lp-gallery__header">
        <div className="lp-gallery__header-row">
          <h1 className="lp-gallery__title">Landing previews</h1>
          <ThemeToggle />
        </div>
        <p className="lp-gallery__lead">
          Temporary gallery to compare visual directions. Production home at{" "}
          <Link to="/">/</Link> is unchanged. Open a variant, then tell us which
          slug to promote. Theme toggle follows the app light/dark preference.
        </p>
      </header>
      <ul className="lp-gallery__list">
        {VARIANTS.map((v) => (
          <li key={v.slug} className="lp-gallery__item">
            <Link to={`/preview/${v.slug}`} className="lp-gallery__link">
              <span className="lp-gallery__name">{v.name}</span>
              <span className="lp-gallery__slug">/preview/{v.slug}</span>
              <span className="lp-gallery__blurb">{v.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="lp-gallery__current">
        <Link to="/">Current production landing (/)</Link>
      </p>
    </div>
  );
}
