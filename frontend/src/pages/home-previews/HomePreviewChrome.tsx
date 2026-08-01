import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ThemeToggle } from "../../components/ThemeToggle";

type HomePreviewChromeProps = {
  name: string;
  children: ReactNode;
};

export function HomePreviewChrome({ name, children }: HomePreviewChromeProps) {
  return (
    <div className="hp-chrome">
      <div className="hp-chrome__bar">
        <p className="hp-chrome__label">
          Preview: <strong>{name}</strong>
          {" · "}
          <Link to="/preview/home">Back to gallery</Link>
        </p>
        <div className="hp-chrome__actions">
          <ThemeToggle />
        </div>
      </div>
      {children}
    </div>
  );
}
