import { Link } from "react-router-dom";
import { ThemeToggle } from "../../components/ThemeToggle";
import "./auth-previews.css";

const VARIANTS = [
  {
    slug: "signal-card",
    name: "Signal card",
    blurb: "Baseline: flat page + centered auth card (current production feel).",
  },
  {
    slug: "hatch-split-auth",
    name: "Hatch split",
    blurb: "Diagonal hatch; brand copy left, form plane right.",
  },
  {
    slug: "hatch-folio-auth",
    name: "Hatch folio",
    blurb: "Asymmetric mast with brand + form on the folio page.",
  },
  {
    slug: "grid-room-auth",
    name: "Grid room",
    blurb: "Landing-style fine grid; floating form panel.",
  },
  {
    slug: "mesh-stage-auth",
    name: "Mesh stage",
    blurb: "Soft emerald mesh; form on a raised stage card.",
  },
  {
    slug: "ledge-auth",
    name: "Ledge",
    blurb: "Brand ledge on top; form band below over hatch.",
  },
  {
    slug: "swap-split",
    name: "Swap split",
    blurb: "50/50 form + visual; login/register swaps sides with motion.",
  },
] as const;

export function AuthPreviewIndexPage() {
  return (
    <div className="ap-gallery">
      <header className="ap-gallery__header">
        <div className="ap-gallery__header-row">
          <h1 className="ap-gallery__title">Auth layout previews</h1>
          <ThemeToggle />
        </div>
        <p className="ap-gallery__lead">
          Temporary gallery for login/register compositions. Production{" "}
          <Link to="/login">/login</Link> and <Link to="/register">/register</Link>{" "}
          are unchanged. Each variant toggles login ↔ signup in-place.
        </p>
      </header>
      <ul className="ap-gallery__list">
        {VARIANTS.map((v) => (
          <li key={v.slug} className="ap-gallery__item">
            <Link to={`/preview/auth/${v.slug}`} className="ap-gallery__link">
              <span className="ap-gallery__name">{v.name}</span>
              <span className="ap-gallery__slug">/preview/auth/{v.slug}</span>
              <span className="ap-gallery__blurb">{v.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="ap-gallery__current">
        <Link to="/">Back to landing (/)</Link>
      </p>
    </div>
  );
}
