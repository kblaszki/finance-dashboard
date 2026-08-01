import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type PreviewChromeProps = {
  name: string;
  children: ReactNode;
};

export function PreviewChrome({ name, children }: PreviewChromeProps) {
  return (
    <div className="lp-chrome">
      <div className="lp-chrome__bar">
        <p className="lp-chrome__label">
          Preview: <strong>{name}</strong>
          {" · "}
          <Link to="/preview">Back to gallery</Link>
        </p>
        <nav className="lp-chrome__nav">
          <Link to="/login">Log in</Link>
          <Link to="/register" className="lp-chrome__cta">
            Sign up
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
